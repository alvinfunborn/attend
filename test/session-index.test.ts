import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";
import type { RawSession } from "../src/core/types.js";
import { SessionIndexStore } from "../src/core/vendor/session-index-store.js";
import { type SessionIndexSnapshot, WorkerSessionIndex } from "../src/core/vendor/session-index.js";
import { TranscriptPathIndex } from "../src/core/vendor/transcript-index.js";

function waitForSnapshot(
  index: WorkerSessionIndex,
  predicate: (snapshot: SessionIndexSnapshot) => boolean,
  timeoutMs = 10_000,
): Promise<SessionIndexSnapshot> {
  const current = index.snapshot();
  if (predicate(current)) return Promise.resolve(current);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`timed out waiting for session index: ${JSON.stringify(index.snapshot())}`));
    }, timeoutMs);
    const unsubscribe = index.subscribe((snapshot) => {
      if (!predicate(snapshot)) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(snapshot);
    });
  });
}

function rawSession(root: string, lastPrompt: string): RawSession {
  return {
    path: path.join(root, "delta-session.jsonl"),
    vendor: "codex",
    sessionId: "delta-session",
    title: "delta session",
    lastPrompt,
    lastTurnChars: 0,
    chars: lastPrompt.length,
    cwd: root,
    firstTs: 1,
    lastTs: 2,
    prompts: 1,
    actions: 0,
    visits: 1,
  };
}

describe("WorkerSessionIndex", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it("indexes provider transcripts outside the server event loop and publishes revisions", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-index-worker-"));
    roots.push(root);
    const claudeProjects = path.join(root, "claude", "project");
    fs.mkdirSync(claudeProjects, { recursive: true });
    const transcript = path.join(claudeProjects, "session.jsonl");
    fs.writeFileSync(
      transcript,
      `${JSON.stringify({
        type: "user",
        sessionId: "worker-session",
        cwd: root,
        timestamp: new Date().toISOString(),
        message: { content: "first prompt" },
      })}\n`,
    );
    const empty = path.join(root, "empty");
    const config = {
      ...resolveConfig({ positionals: [root], noOpen: true }),
      claudeProjects: path.join(root, "claude"),
      codexSessions: empty,
      cursorProjects: empty,
      cursorSessions: empty,
      antigravityBrain: empty,
      antigravityCapturedSessions: empty,
      copilotSessions: empty,
      copilotCapturedSessions: empty,
      opencodeData: empty,
      opencodeSessions: path.join(root, "opencode-sessions"),
      scanCache: path.join(root, "legacy-scan-cache.json"),
      sessionIndex: path.join(root, "index.sqlite3"),
    };
    const paths = new TranscriptPathIndex();
    const index = new WorkerSessionIndex(config, paths);
    try {
      const first = await waitForSnapshot(
        index,
        (snapshot) =>
          !snapshot.pending &&
          snapshot.sessions.some((session) => session.sessionId === "worker-session"),
      );
      expect(first.revision).toBeGreaterThan(0);
      expect(first.metrics?.parsedBytes).toBeGreaterThan(0);
      expect(first.metrics?.parsedFiles).toBeGreaterThan(0);
      expect(index.lookup("claude", "worker-session")?.title).toBe("first prompt");
      expect(paths.get("claude", "worker-session")).toBe(transcript);

      fs.appendFileSync(
        transcript,
        `${JSON.stringify({
          type: "user",
          sessionId: "worker-session",
          cwd: root,
          timestamp: new Date(Date.now() + 1_000).toISOString(),
          message: { content: "second prompt" },
        })}\n`,
      );
      index.requestRefresh("test append");
      const second = await waitForSnapshot(
        index,
        (snapshot) =>
          snapshot.revision > first.revision &&
          snapshot.sessions.some((session) => session.lastPrompt === "second prompt"),
      );
      expect(
        second.sessions.find((session) => session.sessionId === "worker-session")?.prompts,
      ).toBe(2);
      expect(second.metrics?.parsedFiles).toBe(1);
      expect(second.metrics?.parsedBytes).toBeLessThan(fs.statSync(transcript).size);
    } finally {
      index.close();
    }
  }, 15_000);

  it("shares one durable catalog across instances and transfers the scan lease", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-index-multi-"));
    roots.push(root);
    const claudeProjects = path.join(root, "claude", "project");
    fs.mkdirSync(claudeProjects, { recursive: true });
    const transcript = path.join(claudeProjects, "shared.jsonl");
    fs.writeFileSync(
      transcript,
      `${JSON.stringify({
        type: "user",
        sessionId: "shared-session",
        cwd: root,
        timestamp: new Date().toISOString(),
        message: { content: "shared first" },
      })}\n`,
    );
    const empty = path.join(root, "empty");
    const config = {
      ...resolveConfig({ positionals: [root], noOpen: true }),
      claudeProjects: path.join(root, "claude"),
      codexSessions: empty,
      cursorProjects: empty,
      cursorSessions: empty,
      antigravityBrain: empty,
      antigravityCapturedSessions: empty,
      copilotSessions: empty,
      copilotCapturedSessions: empty,
      opencodeData: empty,
      opencodeSessions: path.join(root, "opencode-sessions"),
      scanCache: path.join(root, "legacy-scan-cache.json"),
      sessionIndex: path.join(root, "index.sqlite3"),
    };
    const first = new WorkerSessionIndex(config);
    const second = new WorkerSessionIndex(config);
    let survivor = second;
    try {
      const [firstReady, secondReady] = await Promise.all([
        waitForSnapshot(first, (snapshot) => !snapshot.pending && snapshot.revision > 0),
        waitForSnapshot(second, (snapshot) => !snapshot.pending && snapshot.revision > 0),
      ]);
      expect(firstReady.epoch).toBe(secondReady.epoch);
      expect(firstReady.revision).toBe(secondReady.revision);
      expect(firstReady.sessions.some((session) => session.sessionId === "shared-session")).toBe(
        true,
      );

      const leader = firstReady.metrics?.leader ? first : second;
      survivor = leader === first ? second : first;
      leader.close();
      fs.appendFileSync(
        transcript,
        `${JSON.stringify({
          type: "user",
          sessionId: "shared-session",
          cwd: root,
          timestamp: new Date(Date.now() + 1_000).toISOString(),
          message: { content: "shared after takeover" },
        })}\n`,
      );
      survivor.requestRefresh("lease takeover");
      const takenOver = await waitForSnapshot(
        survivor,
        (snapshot) =>
          snapshot.revision > firstReady.revision &&
          snapshot.sessions.some((session) => session.lastPrompt === "shared after takeover"),
        12_000,
      );
      expect(takenOver.metrics?.leader).toBe(true);
    } finally {
      first.close();
      second.close();
    }
  }, 20_000);

  it("fences and immediately replaces a lease owned by a dead process", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-index-dead-lease-"));
    roots.push(root);
    const database = path.join(root, "index.sqlite3");
    const abandoned = new SessionIndexStore(database);
    const survivor = new SessionIndexStore(database);
    try {
      const firstToken = abandoned.acquireLease("999999999:abandoned");
      expect(firstToken).toBeTypeOf("number");
      const survivorToken = survivor.acquireLease(`${process.pid}:survivor`);
      expect(survivorToken).toBeGreaterThan(firstToken ?? 0);
      expect(
        abandoned.commit("999999999:abandoned", firstToken ?? 0, [], {}, Date.now()),
      ).toBeNull();
    } finally {
      abandoned.close();
      survivor.close();
    }
  });

  it("polls identity separately and journals only consecutive catalog deltas", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "attend-index-delta-"));
    roots.push(root);
    const store = new SessionIndexStore(path.join(root, "index.sqlite3"));
    const owner = `${process.pid}:delta-test`;
    try {
      const token = store.acquireLease(owner);
      expect(token).toBeTypeOf("number");
      const first = store.commit(owner, token ?? 0, [rawSession(root, "first")], {}, 100);
      expect(first?.revision).toBe(1);
      expect(store.readIdentity()).toMatchObject({
        epoch: first?.epoch,
        revision: 1,
        scannedAt: 100,
        pending: false,
      });
      // Revision zero deliberately has no duplicate full-catalog journal row.
      expect(store.readDeltas(first?.epoch ?? "", 0, 1)).toBeNull();

      const second = store.commit(owner, token ?? 0, [rawSession(root, "second")], {}, 200);
      expect(second?.revision).toBe(2);
      const deltas = store.readDeltas(second?.epoch ?? "", 1, 2);
      expect(deltas).toHaveLength(1);
      expect(deltas?.[0]).toMatchObject({
        baseRevision: 1,
        revision: 2,
        upserts: [{ sessionId: "delta-session", lastPrompt: "second" }],
        removed: [],
      });

      const unchanged = store.commit(owner, token ?? 0, [rawSession(root, "second")], {}, 300);
      expect(unchanged?.revision).toBe(2);
      // No-op scans do not rewrite the overflow-page-backed snapshot row.
      expect(store.readIdentity().scannedAt).toBe(200);
    } finally {
      store.releaseLease(owner);
      store.close();
    }
  });
});
