import { describe, expect, it } from "vitest";
import type {
  ActiveSessionState,
  ChatDriver,
  StartOpts,
  ToolAnswer,
  UserTurn,
} from "../src/chat/driver.js";
import type { UiEvent } from "../src/chat/events.js";
import { ChatDriverRegistry } from "../src/chat/registry.js";

class FakeDriver implements ChatDriver {
  constructor(
    readonly vendor: string,
    private readonly sessions: Record<string, string> = {},
    private readonly active: ActiveSessionState[] = [],
  ) {}

  get(sessionId: string): { cwd: string } | undefined {
    const cwd = this.sessions[sessionId];
    return cwd ? { cwd } : undefined;
  }
  start(_opts: StartOpts): Promise<string> {
    return Promise.resolve("session");
  }
  send(_sessionId: string, _turn: UserTurn): boolean {
    return false;
  }
  canSteer(_sessionId: string): boolean {
    return false;
  }
  steer(_sessionId: string, _turn: UserTurn): Promise<boolean> {
    return Promise.resolve(false);
  }
  answer(_sessionId: string, _answer: ToolAnswer): boolean {
    return false;
  }
  interrupt(_sessionId: string): Promise<boolean> {
    return Promise.resolve(false);
  }
  subscribe(_sessionId: string, _listener: (event: UiEvent) => void): () => void {
    return () => {};
  }
  activeSessions(): string[] {
    return this.active.map((state) => state.sessionId);
  }
  activeSessionStates(): ActiveSessionState[] {
    return this.active;
  }
  onTurnEnd(_listener: (sessionId: string) => void): () => void {
    return () => {};
  }
}

describe("ChatDriverRegistry", () => {
  it("selects adapters by vendor and uses the declared fallback", () => {
    const claude = new FakeDriver("claude");
    const codex = new FakeDriver("codex");
    const registry = new ChatDriverRegistry([claude, codex], "claude");

    expect(registry.forVendor("codex")).toBe(codex);
    expect(registry.forVendor("missing")).toBe(claude);
  });

  it("looks up live cwd and active state across adapters", () => {
    const registry = new ChatDriverRegistry(
      [
        new FakeDriver("claude", { a: "/claude" }),
        new FakeDriver("codex", { b: "/codex" }, [{ sessionId: "b", startedAt: 10 }]),
      ],
      "claude",
    );

    expect(registry.cwdOf("b")).toBe("/codex");
    expect(registry.isActive("b")).toBe(true);
    expect(registry.isActive("a")).toBe(false);
  });

  it("rejects duplicate vendor adapters", () => {
    expect(
      () => new ChatDriverRegistry([new FakeDriver("codex"), new FakeDriver("codex")], "codex"),
    ).toThrow("duplicate chat driver: codex");
  });
});
