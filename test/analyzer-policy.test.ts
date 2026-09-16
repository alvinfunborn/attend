import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnalyzerVerdict, SessionAnalyzer } from "../src/chat/analyzer/index.js";
import { DaemonOrchestrator } from "../src/chat/daemon.js";
import {
  type AnalyzerCatalog,
  type AnalyzerExecution,
  AnalyzerPolicyResolver,
  economicalExecution,
} from "../src/core/analyzer-policy.js";
import { type AnalyzerSettings, AnalyzerSettingsStore } from "../src/core/analyzer-settings.js";
import { CollaborationStore } from "../src/core/collaboration.js";
import { AnalysisCache } from "../src/core/daemon/cache.js";
import { DaemonRegistry } from "../src/core/daemon/registry.js";
import type { ModelOption } from "../src/core/model-options.js";

const folders: string[] = [];
const stores: AnalyzerSettingsStore[] = [];
function folder() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attend-policy-"));
  folders.push(dir);
  return dir;
}
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  for (const dir of folders.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});
const luna: AnalyzerCatalog = {
  live: true,
  source: "live",
  models: [
    {
      value: "gpt-5.6-luna",
      label: "Luna",
      efforts: ["low", "medium"],
      speeds: ["default", "priority"],
    },
  ],
};
const verdict: AnalyzerVerdict = {
  analysis: { brief: "Ready", state: "done", priority: 0, etaMin: 0, reason: "Completed" },
  labels: [],
  observedTurns: [],
};

describe("background settings migration", () => {
  it("defaults only a new install to economical and persists across instances", () => {
    const db = path.join(folder(), "state.db");
    const first = new AnalyzerSettingsStore(db);
    stores.push(first);
    expect(first.get()).toEqual({ mode: "economical", revision: 0 });
    const second = new AnalyzerSettingsStore(db);
    stores.push(second);
    first.set("off");
    expect(second.get()).toEqual({ mode: "off", revision: 1 });
    second.set("follow");
    expect(first.get()).toEqual({ mode: "follow", revision: 2 });
    first.set("follow");
    expect(first.get().revision).toBe(2);
  });
  it.each(["database", "legacy-json"])(
    "preserves %s installations without rewriting old state",
    (kind) => {
      const dir = folder();
      const db = path.join(dir, "state.db");
      const old = path.join(dir, "daemons.json");
      fs.writeFileSync(
        kind === "database" ? db : old,
        kind === "database" ? "" : '{"task":{"daemonId":"old","vendor":"codex","cwd":"/repo"}}',
      );
      const store = new AnalyzerSettingsStore(db, [old]);
      stores.push(store);
      expect(store.get().mode).toBe("legacy_vendor_default");
      if (kind === "legacy-json")
        expect(JSON.parse(fs.readFileSync(old, "utf8")).task.daemonId).toBe("old");
      expect(() => store.set("legacy_vendor_default" as "off")).toThrow();
    },
  );
});

describe("verified economical configurations", () => {
  it("requires live Luna low + standard speed, never bundled/cache or inherited priority", () => {
    expect(economicalExecution("codex", luna)).toEqual({
      model: "gpt-5.6-luna",
      effort: "low",
      speed: "default",
    });
    expect(economicalExecution("codex", { ...luna, live: false })).toBeUndefined();
    expect(
      economicalExecution("codex", {
        ...luna,
        models: [{ ...(luna.models[0] as ModelOption), efforts: ["high"] }],
      }),
    ).toBeUndefined();
  });
  it("pins Claude's verified resolved Haiku and disables thinking/fast without inventing effort", () => {
    const models = [{ value: "haiku", label: "Haiku", resolvedModel: "claude-haiku-4-5-20251001" }];
    expect(economicalExecution("claude", { ...luna, models })).toEqual({
      model: "claude-haiku-4-5-20251001",
      disableThinking: true,
      speed: "standard",
    });
    expect(
      economicalExecution("claude", {
        ...luna,
        models: [{ ...(models[0] as ModelOption), resolvedModel: "claude-opus-4-6" }],
      }),
    ).toBeUndefined();
  });
  it("uses Antigravity's exact low slug without an extra effort override", () => {
    expect(
      economicalExecution("antigravity", {
        ...luna,
        models: [{ value: "gemini-3.8-flash-low", label: "Flash" }],
      }),
    ).toEqual({ model: "gemini-3.8-flash-low" });
    expect(
      economicalExecution("antigravity", {
        ...luna,
        models: [{ value: "gemini-3.8-flash-high", label: "Flash" }],
      }),
    ).toBeUndefined();
  });
  it("requires Cursor's exact nonfast nonMax configuration; never synthesizes variants", () => {
    expect(economicalExecution("cursor", luna)).toBeUndefined();
    const catalog = {
      ...luna,
      models: [
        {
          ...(luna.models[0] as ModelOption),
          configurations: [{ value: "provider-owned-luna-low", effort: "low", speed: "false" }],
        },
      ],
    };
    expect(economicalExecution("cursor", catalog)).toEqual({ model: "provider-owned-luna-low" });
    for (const model of catalog.models)
      for (const variant of model.configurations) variant.speed = "true";
    expect(economicalExecution("cursor", catalog)).toBeUndefined();
  });
  it("rejects Copilot auto/disabled and uses advertised effort and billing within audited candidates", () => {
    expect(
      economicalExecution("copilot", { ...luna, models: [{ value: "auto", label: "Auto" }] }),
    ).toBeUndefined();
    expect(
      economicalExecution("copilot", {
        ...luna,
        models: [{ ...(luna.models[0] as ModelOption), policy: "disabled" }],
      }),
    ).toBeUndefined();
    expect(
      economicalExecution("copilot", {
        ...luna,
        models: [
          { ...(luna.models[0] as ModelOption), billingMultiplier: 1 },
          { value: "claude-haiku-4.5", label: "Haiku", billingMultiplier: 0.33 },
        ],
      }),
    ).toEqual({ model: "claude-haiku-4.5" });
  });
});

function harness(initial: AnalyzerSettings["mode"] = "economical", shared?: string) {
  const dir = shared ?? folder();
  const store = new AnalyzerSettingsStore(path.join(dir, "state.db"));
  stores.push(store);
  if (initial !== "legacy_vendor_default") store.set(initial);
  let work: AnalyzerExecution = { model: "gpt-main", effort: "high", speed: "priority" };
  let now = 100;
  const load = vi.fn(async () => luna);
  const policy = new AnalyzerPolicyResolver(
    () => store.get(),
    load,
    () => work,
    () => now,
  );
  let n = 0;
  const analyzer: SessionAnalyzer = {
    vendor: "codex",
    spawn: vi.fn(async (_cwd, observe) => {
      const id = `daemon-${++n}`;
      observe?.(id);
      return id;
    }),
    analyze: vi.fn(async () => structuredClone(verdict)),
    avoidancePrompt: vi.fn(async () => "draft"),
  };
  const registry = new DaemonRegistry(path.join(dir, "registry.json"));
  const cache = new AnalysisCache(path.join(dir, "cache.json"));
  const orch = new DaemonOrchestrator(registry, cache, [analyzer]);
  orch.configurePolicy(policy);
  return {
    dir,
    store,
    policy,
    load,
    analyzer,
    registry,
    cache,
    orch,
    setWork: (value: AnalyzerExecution) => {
      work = value;
    },
    tick: () => {
      now += 61_000;
    },
  };
}

describe("background policy lifecycle", () => {
  it("passes one economical profile through spawn, analysis and avoidance, leaving work settings untouched", async () => {
    const h = harness();
    await h.orch.ensureDaemon("task", "codex", "/repo");
    await h.orch.analyzeTask("task", "/repo");
    await h.orch.ensureAvoidancePrompt("task", "/repo");
    const selected = { model: "gpt-5.6-luna", effort: "low", speed: "default", verifyModel: true };
    expect(h.analyzer.spawn).toHaveBeenCalledWith("/repo", expect.any(Function), selected);
    expect(h.analyzer.analyze).toHaveBeenLastCalledWith(
      "daemon-1",
      "/repo",
      "task",
      undefined,
      undefined,
      "",
      selected,
    );
    expect(h.analyzer.avoidancePrompt).toHaveBeenLastCalledWith(
      "daemon-1",
      "/repo",
      "task",
      "",
      selected,
    );
    h.store.set("follow");
    await h.orch.analyzeTask("task", "/repo");
    expect(h.analyzer.spawn).toHaveBeenLastCalledWith("/repo", expect.any(Function), {
      model: "gpt-main",
      effort: "high",
      speed: "priority",
    });
    expect(h.orch.isDaemon("daemon-1")).toBe(true);
    expect(h.orch.isDaemon("daemon-2")).toBe(true);
    expect(h.load).toHaveBeenCalledTimes(1);
  });
  it("off tracks product sessions for later re-enable, never enrolls external sessions", async () => {
    const h = harness("off");
    expect(await h.orch.ensureDaemon("task", "codex", "/repo")).toBeNull();
    expect(h.orch.hasDaemon("task")).toBe(true);
    await h.orch.analyzeTask("task", "/repo");
    await h.orch.ensureAvoidancePrompt("task", "/repo");
    expect(h.load).not.toHaveBeenCalled();
    expect(h.analyzer.spawn).not.toHaveBeenCalled();
    h.store.set("economical");
    await h.orch.analyzeTask("external", "/repo");
    expect(h.analyzer.spawn).not.toHaveBeenCalled();
    expect(await h.orch.analyzeTask("task", "/repo")).toMatchObject({ brief: "Ready" });
  });
  it("drops in-flight results after another instance changes mode, including avoidance", async () => {
    const h = harness();
    await h.orch.ensureDaemon("task", "codex", "/repo");
    let finish!: (result: AnalyzerVerdict) => void;
    vi.mocked(h.analyzer.analyze).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = h.orch.analyzeTask("task", "/repo");
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    const other = new AnalyzerSettingsStore(path.join(h.dir, "state.db"));
    stores.push(other);
    other.set("off");
    finish(structuredClone(verdict));
    expect(await pending).toBeNull();
    expect(h.orch.analysis("task")).toBeNull();
    other.set("economical");
    await h.orch.analyzeTask("task", "/repo");
    let finishPrompt!: (result: string) => void;
    vi.mocked(
      h.analyzer.avoidancePrompt as NonNullable<SessionAnalyzer["avoidancePrompt"]>,
    ).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishPrompt = resolve;
        }),
    );
    const prompt = h.orch.ensureAvoidancePrompt("task", "/repo");
    await vi.waitFor(() => expect(finishPrompt).toBeTypeOf("function"));
    other.set("off");
    finishPrompt("obsolete");
    expect(await prompt).toBeNull();
    expect(h.cache.get("task")?.avoidancePrompt).toBeUndefined();
  });
  it("invalidates follow results when the work session changes and keeps catalogs per workspace", async () => {
    const h = harness("follow");
    await h.orch.ensureDaemon("task", "codex", "/a");
    await h.orch.analyzeTask("task", "/a");
    h.setWork({ model: "gpt-new", effort: "low", speed: "default" });
    expect(h.orch.analysis("task")).toBeNull();
    await h.orch.analyzeTask("task", "/a");
    expect(h.analyzer.spawn).toHaveBeenLastCalledWith("/a", expect.any(Function), {
      model: "gpt-new",
      effort: "low",
      speed: "default",
    });
    await h.orch.ensureDaemon("other", "codex", "/b");
    expect(h.load).toHaveBeenCalledTimes(2);
  });
  it("fails closed on unavailable catalogs or provider errors and retries only after cooldown", async () => {
    const h = harness();
    h.load.mockResolvedValueOnce({ models: [], live: false, source: "unavailable" });
    await h.orch.ensureDaemon("task", "codex", "/repo");
    expect(h.analyzer.spawn).not.toHaveBeenCalled();
    h.tick();
    vi.mocked(h.analyzer.spawn).mockRejectedValueOnce(new Error("model not allowed"));
    expect(await h.orch.analyzeTask("task", "/repo")).toBeNull();
    await h.orch.analyzeTask("task", "/repo");
    expect(h.analyzer.spawn).toHaveBeenCalledTimes(1);
    h.tick();
    expect(await h.orch.analyzeTask("task", "/repo")).toMatchObject({ brief: "Ready" });
  });
  it("coalesces turn ends that arrive together while asynchronous policy resolution is pending", async () => {
    const h = harness();
    await h.orch.ensureDaemon("task", "codex", "/repo");
    let finish: ((value: AnalyzerVerdict) => void) | undefined;
    vi.mocked(h.analyzer.analyze).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = h.orch.analyzeTask("task", "/repo");
    const second = h.orch.analyzeTask("task", "/repo");
    await vi.waitFor(() => expect(h.analyzer.analyze).toHaveBeenCalledTimes(1));
    await second;
    expect(h.analyzer.analyze).toHaveBeenCalledTimes(1);
    finish?.(structuredClone(verdict));
    await first;
    await vi.waitFor(() => expect(h.analyzer.analyze).toHaveBeenCalledTimes(2));
  });

  it("resolves follow defaults for the selected model, and sends Cursor's advertised variant only", async () => {
    const settings = () => ({ mode: "follow" as const, revision: 1 });
    const catalog = {
      ...luna,
      defaults: { model: "other", effort: "high", speed: "priority" },
      models: [
        {
          value: "gpt-5.6-luna",
          label: "Luna",
          defaultEffort: "low",
          defaultSpeed: "false",
          configurations: [{ value: "exact-luna[low]", effort: "low", speed: "false" }],
        },
      ],
    };
    const resolver = new AnalyzerPolicyResolver(
      settings,
      async () => catalog,
      () => ({ model: "gpt-5.6-luna" }),
    );
    expect((await resolver.resolve("task", "cursor", "/repo")).execution).toEqual({
      model: "exact-luna[low]",
    });
    const unresolved = new AnalyzerPolicyResolver(
      settings,
      async () => ({ models: [], live: false, source: "unavailable" }),
      () => ({}),
    );
    expect((await unresolved.resolve("task", "codex", "/repo")).execution).toBeUndefined();
  });

  it("uses a shared lease to prevent duplicate seeds across Attend instances", async () => {
    const dir = folder();
    const db = path.join(dir, "shared.db");
    const settings = new AnalyzerSettingsStore(db);
    stores.push(settings);
    const collaborationA = new CollaborationStore(db);
    const collaborationB = new CollaborationStore(db);
    const registry = () => new DaemonRegistry(path.join(dir, "registry.json"), db);
    const cache = () => new AnalysisCache(path.join(dir, "cache.json"), db);
    let finish: ((id: string) => void) | undefined;
    const analyzer: SessionAnalyzer = {
      vendor: "codex",
      spawn: vi.fn(
        () =>
          new Promise<string>((resolve) => {
            finish = resolve;
          }),
      ),
      analyze: vi.fn(async () => structuredClone(verdict)),
    };
    const first = new DaemonOrchestrator(registry(), cache(), [analyzer], collaborationA);
    const second = new DaemonOrchestrator(registry(), cache(), [analyzer], collaborationB);
    for (const orch of [first, second])
      orch.configurePolicy(
        new AnalyzerPolicyResolver(
          () => settings.get(),
          async () => luna,
          () => ({}),
        ),
      );
    try {
      const pending = first.ensureDaemon("task", "codex", "/repo");
      await vi.waitFor(() => expect(analyzer.spawn).toHaveBeenCalledOnce());
      expect(await second.ensureDaemon("task", "codex", "/repo")).toBeNull();
      expect(analyzer.spawn).toHaveBeenCalledOnce();
      finish?.("shared-daemon");
      await pending;
      expect(await second.ensureDaemon("task", "codex", "/repo")).toBe("shared-daemon");
      expect(analyzer.spawn).toHaveBeenCalledOnce();
    } finally {
      first.close();
      second.close();
    }
  });

  it("keeps legacy pairings/cached output and sends no explicit model overrides", async () => {
    const dir = folder();
    fs.writeFileSync(path.join(dir, "state.db"), "");
    const h = harness("legacy_vendor_default", dir);
    h.registry.set("task", { daemonId: "legacy", cwd: "/repo", vendor: "codex" });
    h.cache.set("task", structuredClone(verdict.analysis));
    expect(h.orch.analysis("task")?.brief).toBe("Ready");
    await h.orch.ensureDaemon("task", "codex", "/repo");
    await h.orch.analyzeTask("task", "/repo");
    expect(h.analyzer.spawn).not.toHaveBeenCalled();
    expect(h.load).not.toHaveBeenCalled();
    expect(h.analyzer.analyze).toHaveBeenLastCalledWith(
      "legacy",
      "/repo",
      "task",
      undefined,
      undefined,
      "",
      {},
    );
  });
});
