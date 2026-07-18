import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { TranscriptMsg } from "../chat/transcript.js";
import type { AnalysisState } from "./daemon/cache.js";
import { WORK_EVENT_RETENTION_MS } from "./retention-policy.js";
import { configureStateDatabase } from "./state-database.js";

export const TURN_LABEL_CONTRACT_VERSION = "collaboration-v1";
export const MAX_PENDING_TURNS_PER_ANALYSIS = 12;

export type CollaborationIntent =
  | "ask"
  | "learn"
  | "inspect_code"
  | "research"
  | "design"
  | "implement"
  | "debug"
  | "verify"
  | "operate"
  | "decide";

export type CollaborationSteering =
  | "initiate"
  | "continue"
  | "accept"
  | "clarify"
  | "challenge"
  | "correct"
  | "redirect"
  | "reject_partial"
  | "reject_full"
  | "repeat_instruction";

export type CollaborationFeedbackTarget =
  | "none"
  | "answer"
  | "plan"
  | "design"
  | "code_change"
  | "scope"
  | "verification"
  | "process";

export interface CollaborationTurnFact {
  turnId: string;
  vendor: string;
  sessionId: string;
  seq: number;
  previousTurnId: string | null;
  inputKind: "prompt" | "tool_answer" | "queued" | "fork_opening";
  userAt: number | null;
  finishedAt: number | null;
  promptHash: string;
  promptChars: number;
  assistantChars: number;
  readCalls: number;
  writeCalls: number;
  shellCalls: number;
  searchCalls: number;
  webCalls: number;
  testCalls: number;
  toolErrors: number;
  result: "ok" | "error" | "interrupted" | "waiting_input" | "unknown";
  sourceFingerprint: string;
}

/** Transient text accompanies facts only while building an analyzer prompt. */
export interface CollaborationTurnInput extends CollaborationTurnFact {
  userText: string;
  assistantText: string;
}

export interface CollaborationTurnLabel {
  turnId: string;
  intent: CollaborationIntent;
  researchSource?: "official" | "community" | "repository" | "other";
  steering: CollaborationSteering;
  feedbackTarget: CollaborationFeedbackTarget;
  handoff: AnalysisState | null;
  confidence: number | null;
}

export interface CollaborationStats {
  totalTurns: number;
  labeledTurns: number;
  coverageRate: number | null;
  feedbackSamples: number;
  straightThroughRate: number | null;
  reworkRate: number | null;
  completedHandoffRate: number | null;
  intents: Array<{ key: CollaborationIntent; count: number; rate: number }>;
  steering: Array<{ key: CollaborationSteering; count: number; rate: number }>;
}

interface ToolCounts {
  read: number;
  write: number;
  shell: number;
  search: number;
  web: number;
  test: number;
  errors: number;
}

const INTENTS = new Set<CollaborationIntent>([
  "ask",
  "learn",
  "inspect_code",
  "research",
  "design",
  "implement",
  "debug",
  "verify",
  "operate",
  "decide",
]);

const STEERING = new Set<CollaborationSteering>([
  "initiate",
  "continue",
  "accept",
  "clarify",
  "challenge",
  "correct",
  "redirect",
  "reject_partial",
  "reject_full",
  "repeat_instruction",
]);

const TARGETS = new Set<CollaborationFeedbackTarget>([
  "none",
  "answer",
  "plan",
  "design",
  "code_change",
  "scope",
  "verification",
  "process",
]);

const HANDOFFS = new Set<AnalysisState>([
  "continue_ready",
  "needs_decision",
  "needs_input",
  "blocked",
  "needs_review",
  "followup_suggested",
  "done",
]);

function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function toolCounts(messages: TranscriptMsg[]): ToolCounts {
  const counts: ToolCounts = { read: 0, write: 0, shell: 0, search: 0, web: 0, test: 0, errors: 0 };
  for (const message of messages) {
    for (const tool of message.tools) {
      const name = tool.name.toLowerCase();
      const input = typeof tool.input === "string" ? tool.input : JSON.stringify(tool.input ?? "");
      const combined = `${name} ${input}`.toLowerCase();
      if (/write|edit|patch|notebookedit/.test(name)) counts.write += 1;
      else if (/read|view|open|glob|list/.test(name)) counts.read += 1;
      if (/bash|shell|powershell|exec|command/.test(name)) counts.shell += 1;
      if (/search|grep|rg|find/.test(name)) counts.search += 1;
      if (/web|browser|fetch|http/.test(name)) counts.web += 1;
      if (/\btest\b|vitest|jest|pytest|xctest|cargo test|npm test/.test(combined)) counts.test += 1;
      if (tool.isError) counts.errors += 1;
    }
  }
  return counts;
}

/** Group a vendor-neutral transcript into user→assistant interaction turns. */
export function projectCollaborationTurns(
  vendor: string,
  sessionId: string,
  messages: TranscriptMsg[],
  analysisFromAt: number | null = null,
): CollaborationTurnInput[] {
  const groups: Array<{ user: TranscriptMsg; assistant: TranscriptMsg[] }> = [];
  for (const message of messages) {
    if (message.role === "user") groups.push({ user: message, assistant: [] });
    else groups.at(-1)?.assistant.push(message);
  }
  const turns: CollaborationTurnInput[] = [];
  let previousTurnId: string | null = null;
  for (let seq = 0; seq < groups.length; seq += 1) {
    const group = groups[seq];
    if (!group) continue;
    const userAt = group.user.ts ?? null;
    if (analysisFromAt !== null && (userAt === null || userAt < analysisFromAt - 5_000)) continue;
    const userText = group.user.text.trim();
    if (!userText) continue;
    const assistantText = group.assistant
      .map((message) => message.text)
      .join("\n")
      .trim();
    const tools = toolCounts(group.assistant);
    const promptHash = hash(userText);
    const turnId = `turn:${hash(`${vendor}\u0000${sessionId}\u0000${userAt ?? ""}\u0000${seq}\u0000${promptHash}`).slice(0, 32)}`;
    const finishedAt = group.assistant.reduce<number | null>(
      (latest, message) => (message.ts === undefined ? latest : Math.max(latest ?? 0, message.ts)),
      null,
    );
    const sourceFingerprint = hash(
      JSON.stringify({ userText, assistantText, tools, userAt, finishedAt }),
    );
    turns.push({
      turnId,
      vendor,
      sessionId,
      seq,
      previousTurnId,
      inputKind: "prompt",
      userAt,
      finishedAt,
      promptHash,
      promptChars: userText.length,
      assistantChars: assistantText.length,
      readCalls: tools.read,
      writeCalls: tools.write,
      shellCalls: tools.shell,
      searchCalls: tools.search,
      webCalls: tools.web,
      testCalls: tools.test,
      toolErrors: tools.errors,
      result:
        assistantText || group.assistant.some((message) => message.tools.length) ? "ok" : "unknown",
      sourceFingerprint,
      userText,
      assistantText,
    });
    previousTurnId = turnId;
  }
  return turns;
}

export function isCollaborationIntent(value: unknown): value is CollaborationIntent {
  return typeof value === "string" && INTENTS.has(value as CollaborationIntent);
}

export function isCollaborationSteering(value: unknown): value is CollaborationSteering {
  return typeof value === "string" && STEERING.has(value as CollaborationSteering);
}

export function isCollaborationFeedbackTarget(
  value: unknown,
): value is CollaborationFeedbackTarget {
  return typeof value === "string" && TARGETS.has(value as CollaborationFeedbackTarget);
}

export function parseCollaborationHandoff(value: unknown): AnalysisState | null {
  return typeof value === "string" && HANDOFFS.has(value as AnalysisState)
    ? (value as AnalysisState)
    : null;
}

export class CollaborationStore {
  private readonly db: DatabaseSync;

  constructor(private readonly file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(file);
    configureStateDatabase(this.db);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS collaboration_sessions (
        vendor TEXT NOT NULL,
        session_id TEXT NOT NULL,
        cwd TEXT NOT NULL,
        parent_vendor TEXT,
        parent_session_id TEXT,
        relation_kind TEXT NOT NULL DEFAULT 'root',
        relation_created_at INTEGER,
        analysis_from_at INTEGER,
        lease_owner TEXT,
        lease_expires_at INTEGER,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (vendor, session_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS collaboration_turns (
        turn_id TEXT PRIMARY KEY,
        vendor TEXT NOT NULL,
        session_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        previous_turn_id TEXT,
        input_kind TEXT NOT NULL,
        user_at INTEGER,
        finished_at INTEGER,
        prompt_hash TEXT NOT NULL,
        prompt_chars INTEGER NOT NULL,
        assistant_chars INTEGER NOT NULL,
        read_calls INTEGER NOT NULL DEFAULT 0,
        write_calls INTEGER NOT NULL DEFAULT 0,
        shell_calls INTEGER NOT NULL DEFAULT 0,
        search_calls INTEGER NOT NULL DEFAULT 0,
        web_calls INTEGER NOT NULL DEFAULT 0,
        test_calls INTEGER NOT NULL DEFAULT 0,
        tool_errors INTEGER NOT NULL DEFAULT 0,
        result TEXT NOT NULL,
        source_fingerprint TEXT NOT NULL,
        UNIQUE (vendor, session_id, seq, prompt_hash)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS collaboration_turns_user_at_idx
        ON collaboration_turns(user_at);
      CREATE INDEX IF NOT EXISTS collaboration_turns_session_seq_idx
        ON collaboration_turns(vendor, session_id, seq);
      CREATE TABLE IF NOT EXISTS collaboration_labels (
        turn_id TEXT NOT NULL,
        contract_version TEXT NOT NULL,
        intent TEXT NOT NULL,
        research_source TEXT,
        steering TEXT NOT NULL,
        feedback_target TEXT NOT NULL,
        handoff TEXT,
        confidence REAL,
        analyzer_vendor TEXT NOT NULL,
        analyzed_at INTEGER NOT NULL,
        PRIMARY KEY (turn_id, contract_version)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS collaboration_labels_contract_idx
        ON collaboration_labels(contract_version, analyzed_at);
    `);
  }

  close(): void {
    this.db.close();
  }

  ensureSession(
    vendor: string,
    sessionId: string,
    cwd: string,
    relation: {
      parentVendor?: string | null;
      parentSessionId?: string | null;
      kind?: "root" | "fork" | "comment" | "promoted_comment";
      createdAt?: number | null;
      analysisFromAt?: number | null;
    } = {},
  ): void {
    this.db
      .prepare(
        `INSERT INTO collaboration_sessions
           (vendor, session_id, cwd, parent_vendor, parent_session_id, relation_kind,
            relation_created_at, analysis_from_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(vendor, session_id) DO UPDATE SET
           cwd = excluded.cwd,
           parent_vendor = COALESCE(excluded.parent_vendor, collaboration_sessions.parent_vendor),
           parent_session_id = COALESCE(excluded.parent_session_id, collaboration_sessions.parent_session_id),
           relation_kind = CASE WHEN excluded.relation_kind = 'root'
             THEN collaboration_sessions.relation_kind ELSE excluded.relation_kind END,
           relation_created_at = COALESCE(excluded.relation_created_at, collaboration_sessions.relation_created_at),
           analysis_from_at = COALESCE(excluded.analysis_from_at, collaboration_sessions.analysis_from_at),
           updated_at = excluded.updated_at`,
      )
      .run(
        vendor,
        sessionId,
        cwd,
        relation.parentVendor ?? null,
        relation.parentSessionId ?? null,
        relation.kind ?? "root",
        relation.createdAt ?? null,
        relation.analysisFromAt ?? null,
        Date.now(),
      );
  }

  analysisState(
    vendor: string,
    sessionId: string,
  ): { analysisFromAt: number | null; labeledTurnIds: Set<string> } {
    const session = this.db
      .prepare(
        "SELECT analysis_from_at FROM collaboration_sessions WHERE vendor = ? AND session_id = ?",
      )
      .get(vendor, sessionId) as { analysis_from_at: number | null } | undefined;
    const rows = this.db
      .prepare(
        `SELECT l.turn_id FROM collaboration_labels l
         JOIN collaboration_turns t ON t.turn_id = l.turn_id
         WHERE t.vendor = ? AND t.session_id = ? AND l.contract_version = ?`,
      )
      .all(vendor, sessionId, TURN_LABEL_CONTRACT_VERSION) as unknown as Array<{ turn_id: string }>;
    return {
      analysisFromAt: session?.analysis_from_at ?? null,
      labeledTurnIds: new Set(rows.map((row) => row.turn_id)),
    };
  }

  claimAnalysis(vendor: string, sessionId: string, owner: string, leaseMs = 120_000): boolean {
    const now = Date.now();
    const result = this.db
      .prepare(
        `UPDATE collaboration_sessions
         SET lease_owner = ?, lease_expires_at = ?, updated_at = ?
         WHERE vendor = ? AND session_id = ?
           AND (lease_expires_at IS NULL OR lease_expires_at <= ? OR lease_owner = ?)`,
      )
      .run(owner, now + Math.max(1_000, leaseMs), now, vendor, sessionId, now, owner);
    return Number(result.changes) > 0;
  }

  releaseAnalysis(vendor: string, sessionId: string, owner: string): void {
    this.db
      .prepare(
        `UPDATE collaboration_sessions SET lease_owner = NULL, lease_expires_at = NULL
         WHERE vendor = ? AND session_id = ? AND lease_owner = ?`,
      )
      .run(vendor, sessionId, owner);
  }

  saveAnalysis(
    vendor: string,
    sessionId: string,
    cwd: string,
    turns: CollaborationTurnFact[],
    labels: CollaborationTurnLabel[],
  ): void {
    this.ensureSession(vendor, sessionId, cwd);
    const insertTurn = this.db.prepare(
      `INSERT INTO collaboration_turns
         (turn_id, vendor, session_id, seq, previous_turn_id, input_kind, user_at, finished_at,
          prompt_hash, prompt_chars, assistant_chars, read_calls, write_calls, shell_calls,
          search_calls, web_calls, test_calls, tool_errors, result, source_fingerprint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(turn_id) DO UPDATE SET
         finished_at = excluded.finished_at,
         assistant_chars = excluded.assistant_chars,
         read_calls = excluded.read_calls,
         write_calls = excluded.write_calls,
         shell_calls = excluded.shell_calls,
         search_calls = excluded.search_calls,
         web_calls = excluded.web_calls,
         test_calls = excluded.test_calls,
         tool_errors = excluded.tool_errors,
         result = excluded.result,
         source_fingerprint = excluded.source_fingerprint`,
    );
    const insertLabel = this.db.prepare(
      `INSERT INTO collaboration_labels
         (turn_id, contract_version, intent, research_source, steering, feedback_target,
          handoff, confidence, analyzer_vendor, analyzed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(turn_id, contract_version) DO UPDATE SET
         intent = excluded.intent,
         research_source = excluded.research_source,
         steering = excluded.steering,
         feedback_target = excluded.feedback_target,
         handoff = excluded.handoff,
         confidence = excluded.confidence,
         analyzer_vendor = excluded.analyzer_vendor,
         analyzed_at = excluded.analyzed_at`,
    );
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const turn of turns) {
        insertTurn.run(
          turn.turnId,
          turn.vendor,
          turn.sessionId,
          turn.seq,
          turn.previousTurnId,
          turn.inputKind,
          turn.userAt,
          turn.finishedAt,
          turn.promptHash,
          turn.promptChars,
          turn.assistantChars,
          turn.readCalls,
          turn.writeCalls,
          turn.shellCalls,
          turn.searchCalls,
          turn.webCalls,
          turn.testCalls,
          turn.toolErrors,
          turn.result,
          turn.sourceFingerprint,
        );
      }
      for (const label of labels) {
        insertLabel.run(
          label.turnId,
          TURN_LABEL_CONTRACT_VERSION,
          label.intent,
          label.researchSource ?? null,
          label.steering,
          label.feedbackTarget,
          label.handoff,
          label.confidence,
          vendor,
          Date.now(),
        );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  stats(since: number, sessionIds?: Iterable<string>): CollaborationStats {
    const allowed = sessionIds ? new Set(sessionIds) : null;
    const rows = this.db
      .prepare(
        `SELECT t.turn_id, t.vendor, t.session_id, t.seq, l.intent, l.steering,
                l.feedback_target, l.handoff
         FROM collaboration_turns t
         LEFT JOIN collaboration_labels l
           ON l.turn_id = t.turn_id AND l.contract_version = ?
         WHERE COALESCE(t.user_at, t.finished_at, 0) >= ?
         ORDER BY t.vendor, t.session_id, t.seq`,
      )
      .all(TURN_LABEL_CONTRACT_VERSION, since) as unknown as Array<{
      turn_id: string;
      vendor: string;
      session_id: string;
      seq: number;
      intent: CollaborationIntent | null;
      steering: CollaborationSteering | null;
      feedback_target: CollaborationFeedbackTarget | null;
      handoff: AnalysisState | null;
    }>;
    const filtered = allowed ? rows.filter((row) => allowed.has(row.session_id)) : rows;
    const labeled = filtered.filter(
      (row): row is typeof row & { intent: CollaborationIntent; steering: CollaborationSteering } =>
        row.intent !== null && row.steering !== null,
    );
    const intentCounts = new Map<CollaborationIntent, number>();
    const steeringCounts = new Map<CollaborationSteering, number>();
    for (const row of labeled) {
      intentCounts.set(row.intent, (intentCounts.get(row.intent) ?? 0) + 1);
      steeringCounts.set(row.steering, (steeringCounts.get(row.steering) ?? 0) + 1);
    }
    let feedbackSamples = 0;
    let accepted = 0;
    let reworked = 0;
    const completedHandoffs = labeled.filter((row) => row.handoff === "done").length;
    for (let index = 1; index < labeled.length; index += 1) {
      const previous = labeled[index - 1];
      const next = labeled[index];
      if (
        !previous ||
        !next ||
        previous.vendor !== next.vendor ||
        previous.session_id !== next.session_id ||
        next.seq !== previous.seq + 1
      )
        continue;
      feedbackSamples += 1;
      if (next.steering === "accept" || next.steering === "continue") accepted += 1;
      if (
        next.steering === "correct" ||
        next.steering === "redirect" ||
        next.steering === "reject_partial" ||
        next.steering === "reject_full" ||
        next.steering === "repeat_instruction"
      )
        reworked += 1;
    }
    const rate = (value: number, total: number): number | null =>
      total > 0 ? Math.round((value / total) * 1000) / 1000 : null;
    return {
      totalTurns: filtered.length,
      labeledTurns: labeled.length,
      coverageRate: rate(labeled.length, filtered.length),
      feedbackSamples,
      straightThroughRate: rate(accepted, feedbackSamples),
      reworkRate: rate(reworked, feedbackSamples),
      // A completed session is commonly left alone rather than followed by an
      // explicit "accept" message. Report the analyzer's completed handoff for
      // every turn so those quiet completions are represented.
      completedHandoffRate: rate(completedHandoffs, labeled.length),
      intents: [...intentCounts.entries()]
        .map(([key, count]) => ({ key, count, rate: count / Math.max(1, labeled.length) }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
      steering: [...steeringCounts.entries()]
        .map(([key, count]) => ({ key, count, rate: count / Math.max(1, labeled.length) }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
    };
  }

  prune(now = Date.now()): number {
    const result = this.db
      .prepare(
        `DELETE FROM collaboration_turns
         WHERE COALESCE(user_at, finished_at, 0) > 0
           AND COALESCE(user_at, finished_at, 0) < ?`,
      )
      .run(now - WORK_EVENT_RETENTION_MS);
    this.db.exec(
      "DELETE FROM collaboration_labels WHERE turn_id NOT IN (SELECT turn_id FROM collaboration_turns)",
    );
    return Number(result.changes);
  }
}
