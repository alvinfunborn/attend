import type { RawSession } from "../types.js";
import { ClaudeSource } from "./claude.js";
import { CodexSource } from "./codex.js";

/**
 * A vendor transcript backend. New vendors = new implementation; everything
 * downstream (telemetry, priority, UI) is vendor-neutral (DESIGN.md invariant 4).
 */
export interface SessionSource {
  readonly vendor: string;
  scan(): RawSession[];
}

export interface SessionSourceConfig {
  claudeProjects: string;
  codexSessions: string;
}

export function buildSources(config: SessionSourceConfig): SessionSource[] {
  return [new ClaudeSource(config.claudeProjects), new CodexSource(config.codexSessions)];
}

/** Collect sessions from every vendor source. */
export function collectSessions(config: SessionSourceConfig): RawSession[] {
  return buildSources(config).flatMap((s) => s.scan());
}

export { ClaudeSource } from "./claude.js";
export { CodexSource } from "./codex.js";
