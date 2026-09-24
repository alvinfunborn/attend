import type { VendorId } from "./detect.js";

export type VendorCapabilityId =
  | "chat"
  | "daemon"
  | "attachments"
  | "fork"
  | "goal"
  | "steer"
  | "interactiveInput"
  | "modelCatalog"
  | "effort"
  | "speed"
  | "nativeSessionCwd";

export type VendorCapabilitySupport = "native" | "emulated" | "fallback" | "unsupported";

export interface VendorCapability {
  support: VendorCapabilitySupport;
  /** Stable, user-facing behavior Attend uses when the native feature is absent. */
  fallback?: string;
}

export type VendorCapabilities = Record<VendorCapabilityId, VendorCapability>;

const shared = {
  chat: { support: "native" },
  daemon: { support: "native" },
} as const;

const processAttachments = {
  support: "emulated",
  fallback: "Attend materializes attachments as temporary local files and passes their paths.",
} as const;

const CAPABILITIES: Record<VendorId, VendorCapabilities> = {
  claude: {
    ...shared,
    attachments: { support: "native" },
    fork: { support: "native" },
    goal: { support: "native" },
    steer: { support: "native" },
    interactiveInput: { support: "native" },
    modelCatalog: { support: "native" },
    effort: { support: "native" },
    speed: { support: "native" },
    nativeSessionCwd: { support: "native" },
  },
  codex: {
    ...shared,
    attachments: { support: "native" },
    fork: { support: "native" },
    goal: { support: "native" },
    steer: { support: "native" },
    interactiveInput: { support: "native" },
    modelCatalog: { support: "native" },
    effort: { support: "native" },
    speed: { support: "native" },
    nativeSessionCwd: { support: "native" },
  },
  cursor: {
    ...shared,
    attachments: processAttachments,
    fork: {
      support: "emulated",
      fallback: "Attend creates a new Cursor session seeded with the parent transcript.",
    },
    goal: {
      support: "unsupported",
    },
    steer: {
      support: "unsupported",
    },
    interactiveInput: {
      support: "fallback",
      fallback: "Answer the question in the next user turn.",
    },
    modelCatalog: { support: "native" },
    effort: {
      support: "emulated",
      fallback: "Effort is encoded in Cursor's advertised model configuration.",
    },
    speed: {
      support: "emulated",
      fallback: "Speed is encoded in Cursor's advertised model configuration.",
    },
    nativeSessionCwd: { support: "native" },
  },
  antigravity: {
    ...shared,
    attachments: processAttachments,
    fork: {
      support: "emulated",
      fallback: "Attend creates a new Antigravity session seeded with the parent transcript.",
    },
    goal: {
      support: "unsupported",
    },
    steer: {
      support: "unsupported",
    },
    interactiveInput: {
      support: "fallback",
      fallback: "Headless Antigravity soft-denies interactive prompts; answer in the next turn.",
    },
    modelCatalog: { support: "native" },
    effort: { support: "native" },
    speed: {
      support: "unsupported",
      fallback: "Antigravity CLI does not expose a speed tier.",
    },
    nativeSessionCwd: { support: "native" },
  },
  copilot: {
    ...shared,
    attachments: processAttachments,
    fork: {
      support: "emulated",
      fallback: "Attend creates a new Copilot session seeded with the parent transcript.",
    },
    goal: {
      support: "unsupported",
    },
    steer: {
      support: "unsupported",
    },
    interactiveInput: {
      support: "fallback",
      fallback:
        "Copilot runs with ask_user disabled; provide missing information in the next user turn.",
    },
    modelCatalog: { support: "native" },
    effort: { support: "native" },
    speed: {
      support: "unsupported",
      fallback: "Copilot CLI does not expose a speed tier.",
    },
    nativeSessionCwd: { support: "native" },
  },
  opencode: {
    ...shared,
    attachments: processAttachments,
    fork: {
      support: "emulated",
      fallback: "Attend creates a new OpenCode session seeded with the parent transcript.",
    },
    goal: {
      support: "unsupported",
    },
    steer: {
      support: "native",
    },
    interactiveInput: {
      support: "native",
    },
    modelCatalog: { support: "native" },
    effort: {
      support: "emulated",
      fallback:
        "OpenCode passes the selected variant through the prompt variant field when the provider supports it.",
    },
    speed: {
      support: "unsupported",
      fallback: "OpenCode does not expose a speed tier.",
    },
    nativeSessionCwd: { support: "native" },
  },
};

export function vendorCapabilities(vendor: VendorId): VendorCapabilities {
  return CAPABILITIES[vendor];
}

export function nativeCapability(vendor: VendorId, capability: VendorCapabilityId): boolean {
  return CAPABILITIES[vendor][capability].support === "native";
}

export function capabilityFallback(
  vendor: VendorId,
  capability: VendorCapabilityId,
): string | null {
  return CAPABILITIES[vendor][capability].fallback ?? null;
}

export function capabilityUnavailable(
  vendor: VendorId,
  capability: VendorCapabilityId,
): {
  ok: false;
  error: string;
  code: "capability_unavailable";
  vendor: VendorId;
  capability: VendorCapabilityId;
  fallback: string | null;
} {
  const fallback = capabilityFallback(vendor, capability);
  return {
    ok: false,
    error: fallback
      ? `${vendor} does not expose native ${capability}; ${fallback}`
      : `${vendor} does not expose native ${capability}`,
    code: "capability_unavailable",
    vendor,
    capability,
    fallback,
  };
}
