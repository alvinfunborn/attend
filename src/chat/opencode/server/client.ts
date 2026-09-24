import type { ChildProcess, SpawnOptions } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import type { Event, OpencodeClient } from "@opencode-ai/sdk";
import { createOpencodeClient } from "@opencode-ai/sdk";
import { spawnCli, spawnCliSync } from "../../../core/spawn.js";

/**
 * The persistent OpenCode transport: one `opencode serve` process owned by
 * Attend, driven through the official SDK instead of a per-turn `opencode run`.
 *
 * Why a server instead of a process per turn: `opencode run` keeps a server
 * alive after its terminal event and can keep working on its own (compaction
 * auto-continue), so an Attend crash used to leave a detached loop writing
 * into the same session while the next Attend spawned a second writer. A
 * single long-lived server keeps session ownership on the server side: abort
 * is an API call, concurrent prompts serialize, and a leftover server is
 * reaped from the recorded pid before a new one starts.
 */
export interface OpencodeServerLike {
  start(): Promise<void>;
  createSession(directory: string): Promise<string>;
  prompt(request: OpencodePromptRequest): Promise<void>;
  abort(sessionId: string, directory: string): Promise<boolean>;
  replyPermission(sessionId: string, permissionId: string, directory: string): Promise<void>;
  /** Answer the native `question` tool ask; OpenCode then continues the turn. */
  replyQuestion(questionId: string, answers: string[][], directory: string): Promise<void>;
  /**
   * Feed guidance into the running turn (`delivery: "steer"`), the OpenCode
   * server's equivalent of the desktop app's mid-turn "guide" message.
   */
  steerPrompt(sessionId: string, text: string): Promise<void>;
  /** One shared event subscription; listeners survive stream reconnects. */
  /**
   * One event subscription scoped to `directory`. OpenCode's `/event` stream is
   * per-project: a subscription without a directory only sees the server's
   * startup project, so events for any other workspace never arrive.
   */
  onEvent(directory: string, listener: (event: Event) => void): () => void;
  /** Fired when the server or a directory's event stream drops mid-flight. */
  onDisconnect(directory: string, listener: (error: Error) => void): () => void;
  shutdown(): void;
}

interface PumpState {
  readonly listeners: Set<(event: Event) => void>;
  readonly disconnectListeners: Set<(error: Error) => void>;
  running: Promise<void> | null;
}

export interface OpencodePromptRequest {
  sessionId: string;
  directory: string;
  text: string;
  /** Attend's opaque "provider/model" id, split for the SDK model ref. */
  model?: string;
  /** Attend's opaque effort id; OpenCode calls this a model variant. */
  variant?: string;
}

type SpawnFn = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;

export interface OpencodeServerOptions {
  bin: string;
  /** Records the live server pid so a later Attend can reap an orphan. */
  pidFile?: string;
  env?: NodeJS.ProcessEnv;
  startupTimeoutMs?: number;
  /** Injectable process boundary; tests never spawn a real server. */
  spawn?: SpawnFn;
  pickPort?: () => Promise<number>;
  /** Liveness + command-line probe used to reap a stale server. */
  processCommand?: (pid: number) => Promise<string | null>;
  killPid?: (pid: number, signal: NodeJS.Signals) => void;
}

const DEFAULT_STARTUP_TIMEOUT_MS = 10_000;
const LISTENING_LINE = /opencode server listening on (https?:\/\/\S+)/;

/** Builds the SDK prompt body, including the variant the generated type omits. */
export function opencodePromptBody(request: OpencodePromptRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    parts: [{ type: "text", text: request.text }],
  };
  const slash = request.model?.indexOf("/") ?? -1;
  if (request.model && slash > 0) {
    body.model = {
      providerID: request.model.slice(0, slash),
      modelID: request.model.slice(slash + 1),
    };
  }
  // The server accepts `variant` (it is absent from the generated SDK type).
  if (request.variant) body.variant = request.variant;
  return body;
}

export class OpencodeServerClient implements OpencodeServerLike {
  private readonly bin: string;
  private readonly pidFile: string | null;
  private readonly env: NodeJS.ProcessEnv;
  private readonly startupTimeoutMs: number;
  private readonly spawn: SpawnFn;
  private readonly pickPort: () => Promise<number>;
  private readonly processCommand: (pid: number) => Promise<string | null>;
  private readonly killPid: (pid: number, signal: NodeJS.Signals) => void;
  private readonly pumps = new Map<string, PumpState>();
  private child: ChildProcess | null = null;
  private sdk: OpencodeClient | null = null;
  private baseUrl: string | null = null;
  private starting: Promise<void> | null = null;
  private stopped = false;
  private stderr = "";

  constructor(options: OpencodeServerOptions) {
    this.bin = options.bin;
    this.pidFile = options.pidFile ?? null;
    this.env = options.env ?? {};
    this.startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
    this.spawn = options.spawn ?? spawnCli;
    this.pickPort = options.pickPort ?? freePort;
    this.processCommand = options.processCommand ?? defaultProcessCommand;
    this.killPid = options.killPid ?? ((pid, signal) => process.kill(pid, signal));
  }

  start(): Promise<void> {
    if (this.sdk && this.child) return Promise.resolve();
    if (this.starting) return this.starting;
    this.starting = this.open().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  async createSession(directory: string): Promise<string> {
    const client = await this.ensureStarted();
    const result = await client.session.create({
      body: {},
      query: { directory },
      throwOnError: true,
    });
    return result.data.id;
  }

  async prompt(request: OpencodePromptRequest): Promise<void> {
    const client = await this.ensureStarted();
    await client.session.promptAsync({
      path: { id: request.sessionId },
      query: { directory: request.directory },
      // The generated body type predates the server's `variant` field.
      body: opencodePromptBody(request) as never,
      throwOnError: true,
    });
  }

  async abort(sessionId: string, directory: string): Promise<boolean> {
    try {
      const client = await this.ensureStarted();
      const result = await client.session.abort({
        path: { id: sessionId },
        query: { directory },
        throwOnError: true,
      });
      return result.data;
    } catch {
      return false;
    }
  }

  async replyPermission(sessionId: string, permissionId: string, directory: string): Promise<void> {
    try {
      const client = await this.ensureStarted();
      await client.postSessionIdPermissionsPermissionId({
        path: { id: sessionId, permissionID: permissionId },
        query: { directory },
        body: { response: "always" },
        throwOnError: true,
      });
    } catch {
      // A denied or expired ask must never fail the turn itself.
    }
  }

  async replyQuestion(questionId: string, answers: string[][], directory: string): Promise<void> {
    await this.ensureStarted();
    if (!this.baseUrl) throw new Error("opencode server is not running");
    // The bundled SDK's generated types predate the question API, so call the
    // documented endpoint directly: POST /question/{requestID}/reply?directory=…
    // (verified against opencode 1.18.31; the session-scoped v2 route 404s here).
    const url = `${this.baseUrl}/question/${encodeURIComponent(questionId)}/reply`;
    const response = await fetch(`${url}?${new URLSearchParams({ directory })}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    if (!response.ok) throw new Error(`opencode question reply failed (${response.status})`);
  }

  async steerPrompt(sessionId: string, text: string): Promise<void> {
    await this.ensureStarted();
    if (!this.baseUrl) throw new Error("opencode server is not running");
    // `delivery: "steer"` admits the message into the in-flight turn instead of
    // queueing a new one. This is the v2 prompt route (the legacy
    // `prompt_async` has no delivery mode).
    const response = await fetch(
      `${this.baseUrl}/api/session/${encodeURIComponent(sessionId)}/prompt`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: { text }, delivery: "steer" }),
      },
    );
    if (!response.ok) throw new Error(`opencode steer failed (${response.status})`);
  }

  onEvent(directory: string, listener: (event: Event) => void): () => void {
    const state = this.pumpFor(directory);
    state.listeners.add(listener);
    this.ensurePump(directory, state);
    return () => {
      state.listeners.delete(listener);
      this.prunePump(directory, state);
    };
  }

  onDisconnect(directory: string, listener: (error: Error) => void): () => void {
    const state = this.pumpFor(directory);
    state.disconnectListeners.add(listener);
    this.ensurePump(directory, state);
    return () => {
      state.disconnectListeners.delete(listener);
      this.prunePump(directory, state);
    };
  }

  private pumpFor(directory: string): PumpState {
    let state = this.pumps.get(directory);
    if (!state) {
      state = { listeners: new Set(), disconnectListeners: new Set(), running: null };
      this.pumps.set(directory, state);
    }
    return state;
  }

  /** Drop an unused pump so its reconnect loop stops and its stream closes. */
  private prunePump(directory: string, state: PumpState): void {
    if (state.listeners.size || state.disconnectListeners.size) return;
    if (this.pumps.get(directory) === state) this.pumps.delete(directory);
  }

  shutdown(): void {
    this.stopped = true;
    const child = this.child;
    this.child = null;
    this.sdk = null;
    this.baseUrl = null;
    this.stderr = "";
    this.pumps.clear();
    this.removePidFile();
    if (child) killChild(child);
  }

  private async ensureStarted(): Promise<OpencodeClient> {
    await this.start();
    if (!this.sdk) throw new Error("opencode server is not running");
    return this.sdk;
  }

  private async open(): Promise<void> {
    this.stopped = false;
    await this.sweepStaleServer();
    const port = await this.pickPort();
    const child = this.spawn(this.bin, ["serve", "--hostname=127.0.0.1", `--port=${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
      // The server is Attend's child, never a detached process group: when
      // Attend exits the process dies with it instead of orphaning a writer.
      detached: false,
      env: serverEnv(this.env),
    });
    this.child = child;
    this.stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      this.stderr = (this.stderr + chunk).slice(-4000);
    });
    child.once("exit", (code, signal) => this.handleExit(child, code, signal));
    this.writePidFile(child.pid);
    try {
      const url = await this.waitForUrl(child, this.startupTimeoutMs);
      this.baseUrl = url;
      this.sdk = createOpencodeClient({ baseUrl: url });
      for (const [directory, state] of this.pumps) this.ensurePump(directory, state);
    } catch (error) {
      killChild(child);
      this.removePidFile();
      if (this.child === child) {
        this.child = null;
        this.stderr = "";
      }
      throw error;
    }
  }

  private waitForUrl(child: ChildProcess, timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let buffer = "";
      let settled = false;
      const finish = (error: Error | null, url?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.stdout?.off("data", onData);
        child.off("exit", onExit);
        child.off("error", onError);
        if (error) reject(error);
        else resolve(url as string);
      };
      const onData = (chunk: Buffer | string) => {
        buffer = (buffer + String(chunk)).slice(-4096);
        const match = buffer.match(LISTENING_LINE);
        if (match?.[1]) finish(null, match[1]);
      };
      const onExit = () =>
        finish(new Error(`opencode server exited during startup${this.exitDetail()}`));
      const onError = (error: Error) => finish(error);
      const timer = setTimeout(
        () => finish(new Error(`opencode server did not start within ${timeoutMs}ms`)),
        timeoutMs,
      );
      child.stdout?.on("data", onData);
      child.once("exit", onExit);
      child.once("error", onError);
    });
  }

  private handleExit(
    child: ChildProcess,
    code: number | null,
    signal: NodeJS.Signals | null,
  ): void {
    if (this.child !== child) return;
    this.child = null;
    this.sdk = null;
    this.baseUrl = null;
    const detail = this.stderr.trim();
    this.stderr = "";
    if (this.stopped) return;
    const error = new Error(
      `opencode server exited (${signal ?? String(code ?? "unknown")})${detail ? `: ${detail}` : ""}`,
    );
    for (const state of this.pumps.values()) {
      for (const listener of [...state.disconnectListeners]) listener(error);
    }
  }

  private ensurePump(directory: string, state: PumpState): void {
    if (state.running || this.stopped || !this.sdk) return;
    state.running = this.runPump(directory, state).finally(() => {
      state.running = null;
    });
  }

  private async runPump(directory: string, state: PumpState): Promise<void> {
    while (!this.stopped && this.sdk && this.pumps.get(directory) === state) {
      const client = this.sdk;
      const failure = new Error("opencode server event stream disconnected");
      try {
        const subscription = await client.event.subscribe({ query: { directory } });
        for await (const event of subscription.stream) {
          if (this.stopped || this.sdk !== client || this.pumps.get(directory) !== state) break;
          for (const listener of [...state.listeners]) listener(event);
        }
      } catch {
        // Reconnect below; in-flight turns learn about the gap explicitly.
      }
      if (this.stopped || this.sdk !== client || this.pumps.get(directory) !== state) break;
      for (const listener of [...state.disconnectListeners]) listener(failure);
      await delay(500);
    }
  }

  private exitDetail(): string {
    const detail = this.stderr.trim();
    return detail ? `: ${detail}` : "";
  }

  private readPidRecord(file: string): { owner: number | null; server: number | null } | null {
    let raw: string;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch {
      return null;
    }
    const numbers = raw
      .trim()
      .split(/\s+/)
      .map((token) => Number.parseInt(token, 10))
      .filter((value) => Number.isInteger(value) && value > 0);
    if (numbers.length === 0) return null;
    // Current records are `<attendPid> <serverPid>`; the legacy file held only
    // the server pid, so its owner is unknown.
    const first = numbers[0];
    if (first === undefined) return null;
    if (numbers.length === 1) return { owner: null, server: first };
    const second = numbers[1];
    if (second === undefined) return { owner: null, server: first };
    return { owner: first, server: second };
  }

  /** This instance's record file: one per Attend so instances never reap each other. */
  private ownerPidFile(): string | null {
    return this.pidFile ? `${this.pidFile}.${process.pid}` : null;
  }

  private isAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      // EPERM means the process exists but belongs to another user.
      return (error as NodeJS.ErrnoException).code === "EPERM";
    }
  }

  private writePidFile(pid: number | undefined): void {
    const file = this.ownerPidFile();
    if (!file || !pid) return;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${process.pid} ${pid}\n`);
    } catch {
      // Losing the pid record only costs orphan reaping, never the turn.
    }
  }

  private removePidFile(): void {
    const file = this.ownerPidFile();
    if (!file) return;
    try {
      fs.rmSync(file, { force: true });
    } catch {
      // Best effort.
    }
  }

  private removeFile(file: string): void {
    try {
      fs.rmSync(file, { force: true });
    } catch {
      // Best effort.
    }
  }

  /**
   * Reap only genuine orphans — a server recorded by an Attend that is no longer
   * running. Records are per-Attend (`<base>.<attendPid>`), so two concurrent
   * Attends can never SIGTERM each other's live server (the shared single-file
   * scheme did exactly that, killing every session whenever a second instance
   * started). Legacy owner-less records are only cleaned up once already dead.
   */
  private async sweepStaleServer(): Promise<void> {
    if (!this.pidFile || process.platform === "win32") return;
    const dir = path.dirname(this.pidFile);
    const base = path.basename(this.pidFile);
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry !== base && !entry.startsWith(`${base}.`)) continue;
      const file = path.join(dir, entry);
      const record = this.readPidRecord(file);
      if (!record?.server) {
        this.removeFile(file);
        continue;
      }
      if (record.owner === process.pid) continue;
      if (record.owner !== null && this.isAlive(record.owner)) continue;
      if (record.owner === null) {
        if (!this.isAlive(record.server)) this.removeFile(file);
        continue;
      }
      await this.killServer(record.server);
      this.removeFile(file);
    }
  }

  private async killServer(pid: number): Promise<void> {
    const command = await this.processCommand(pid);
    if (!command || !/\bopencode\b/i.test(command) || !/\bserve\b/.test(command)) return;
    try {
      this.killPid(pid, "SIGTERM");
    } catch {
      return;
    }
    const deadline = Date.now() + 1500;
    while (Date.now() < deadline) {
      if (!(await this.processCommand(pid))) return;
      await delay(100);
    }
    if (await this.processCommand(pid)) {
      try {
        this.killPid(pid, "SIGKILL");
      } catch {
        // Already gone.
      }
    }
  }
}

/**
 * Environment for the spawned server.
 *
 * Two overrides, both making the private server behave the way the chat console
 * expects:
 *
 * 1. The OpenCode desktop app exports `OPENCODE_SERVER_USERNAME`/`_PASSWORD`
 *    into the shell that launches Attend. `opencode serve` reads their mere
 *    presence as "require HTTP Basic auth", but this SDK client connects
 *    without credentials, so every request would 401. Attend owns this
 *    loopback-only server, so the desktop's credentials are dropped and it
 *    runs credential-free like the per-turn `opencode run` it replaced.
 * 2. `opencode serve` has no `--auto` flag, so without config the server keeps
 *    its default permission policy (e.g. `external_directory: ask`) and every
 *    chat turn blocks until the ask is answered. Injecting `permission:
 *    "allow"` is the server-side equivalent of `opencode run --auto` / Claude
 *    bypassPermissions; OpenCode merges env config over the on-disk config, so
 *    the user's providers/compaction settings still apply.
 */
function serverEnv(extra: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const {
    OPENCODE_SERVER_USERNAME: _username,
    OPENCODE_SERVER_PASSWORD: _password,
    ...env
  } = { ...process.env, ...extra };
  env.OPENCODE_CONFIG_CONTENT = withAutoApprove(env.OPENCODE_CONFIG_CONTENT);
  return env;
}

/** Adds an allow-all permission policy without discarding existing env config. */
export function withAutoApprove(existing: string | undefined): string {
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        if (record.permission === undefined)
          return JSON.stringify({ ...record, permission: "allow" });
        return existing;
      }
    } catch {
      // Fall through to a fresh config below.
    }
  }
  return JSON.stringify({ permission: "allow" });
}

function killChild(child: ChildProcess): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    child.kill("SIGTERM");
  } catch {
    // Already gone.
  }
  const timer = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) {
      try {
        child.kill("SIGKILL");
      } catch {
        // Already gone.
      }
    }
  }, 1500);
  timer.unref?.();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref?.();
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      if (!port) {
        server.close(() => reject(new Error("could not allocate a port")));
        return;
      }
      server.close(() => resolve(port));
    });
  });
}

async function defaultProcessCommand(pid: number): Promise<string | null> {
  try {
    process.kill(pid, 0);
  } catch {
    return null;
  }
  try {
    const result = spawnCliSync("ps", ["-o", "command=", "-p", String(pid)], {
      encoding: "utf8",
      windowsHide: true,
    });
    const command = String(result.stdout ?? "").trim();
    return command || null;
  } catch {
    return null;
  }
}
