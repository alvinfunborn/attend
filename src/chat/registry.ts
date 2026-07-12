import type { ActiveSessionState, ChatDriver } from "./driver.js";

/** Runtime registry for provider adapters; server code never selects concrete classes. */
export class ChatDriverRegistry {
  private readonly drivers = new Map<string, ChatDriver>();

  constructor(
    adapters: Iterable<ChatDriver>,
    private readonly fallbackVendor: string,
  ) {
    for (const adapter of adapters) this.register(adapter);
    if (!this.drivers.has(fallbackVendor)) {
      throw new Error(`missing fallback chat driver: ${fallbackVendor}`);
    }
  }

  register(adapter: ChatDriver): void {
    if (this.drivers.has(adapter.vendor)) {
      throw new Error(`duplicate chat driver: ${adapter.vendor}`);
    }
    this.drivers.set(adapter.vendor, adapter);
  }

  forVendor(vendor: string | undefined): ChatDriver {
    const adapter = this.drivers.get(vendor ?? "") ?? this.drivers.get(this.fallbackVendor);
    if (!adapter) throw new Error(`missing fallback chat driver: ${this.fallbackVendor}`);
    return adapter;
  }

  values(): ChatDriver[] {
    return [...this.drivers.values()];
  }

  cwdOf(sessionId: string): string {
    for (const adapter of this.drivers.values()) {
      const cwd = adapter.get(sessionId)?.cwd;
      if (cwd) return cwd;
    }
    return "";
  }

  activeStateGroups(): ActiveSessionState[][] {
    return this.values().map((adapter) => adapter.activeSessionStates());
  }

  isActive(sessionId: string): boolean {
    return this.activeStateGroups().some((states) =>
      states.some((state) => state.sessionId === sessionId),
    );
  }
}
