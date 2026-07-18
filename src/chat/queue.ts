import crypto from "node:crypto";
import { JsonFile, type JsonRepository } from "../core/json-file.js";
import { SqliteDocument } from "../core/state-database.js";
import type { ChatAttachment, ChatReference, UserTurn } from "./driver.js";

export interface QueuedChatTurn extends UserTurn {
  id: string;
  sessionId: string;
  cwd: string;
  vendor: string;
  goal?: boolean;
  createdAt: number;
  attachments?: ChatAttachment[];
  /** Resolved at enqueue time so later unpinning cannot change an already-submitted turn. */
  referenceContext?: string;
}

interface SessionQueue {
  parked: boolean;
  items: QueuedChatTurn[];
  lease?: { itemId: string; owner: string; expiresAt: number };
}

interface QueueFile {
  sessions: Record<string, SessionQueue>;
}

export interface ExtractedQueuedChatTurn {
  item: QueuedChatTurn;
  index: number;
  parked: boolean;
}

function cloneTurn(turn: QueuedChatTurn): QueuedChatTurn {
  return {
    ...turn,
    attachments: turn.attachments?.map((attachment) => ({ ...attachment })),
    references: turn.references?.map((reference) => ({ ...reference })),
  };
}

function normalizeQueueFile(value: unknown): QueueFile {
  const input = value && typeof value === "object" ? (value as Partial<QueueFile>) : {};
  const sessions: Record<string, SessionQueue> = {};
  for (const [sessionId, raw] of Object.entries(input.sessions ?? {})) {
    if (!raw || !Array.isArray(raw.items)) continue;
    const items = raw.items
      .filter((item) => item?.id && item.sessionId === sessionId)
      .map(cloneTurn);
    if (items.length) {
      const lease = raw.lease;
      sessions[sessionId] = {
        parked: raw.parked === true,
        items,
        ...(lease &&
        typeof lease.itemId === "string" &&
        typeof lease.owner === "string" &&
        Number.isFinite(lease.expiresAt)
          ? { lease: { itemId: lease.itemId, owner: lease.owner, expiresAt: lease.expiresAt } }
          : {}),
      };
    }
  }
  return { sessions };
}

function activelyLeased(queue: SessionQueue, itemId: string): boolean {
  return queue.lease?.itemId === itemId && queue.lease.expiresAt > Date.now();
}

/** Persistent, browser-independent queued turns, grouped by task session. */
export class ChatQueueStore {
  private readonly data: JsonRepository<QueueFile>;

  constructor(file: string, databaseFile?: string) {
    this.data = databaseFile
      ? new SqliteDocument(databaseFile, "chat-queue", file, normalizeQueueFile)
      : new JsonFile(file, normalizeQueueFile);
  }

  list(sessionId: string): QueuedChatTurn[] {
    return (this.data.read().sessions[sessionId]?.items ?? []).map(cloneTurn);
  }

  peek(sessionId: string): QueuedChatTurn | null {
    const item = this.data.read().sessions[sessionId]?.items[0];
    return item ? cloneTurn(item) : null;
  }

  enqueue(
    sessionId: string,
    input: {
      cwd: string;
      vendor: string;
      text: string;
      attachments?: ChatAttachment[];
      references?: ChatReference[];
      referenceContext?: string;
      goal?: boolean;
    },
  ): QueuedChatTurn {
    return this.data.update((data) => {
      let queue = data.sessions[sessionId];
      if (!queue) {
        queue = { parked: false, items: [] };
        data.sessions[sessionId] = queue;
      }
      const item: QueuedChatTurn = {
        id: crypto.randomUUID(),
        sessionId,
        cwd: input.cwd,
        vendor: input.vendor,
        text: input.text,
        attachments: input.attachments?.map((attachment) => ({ ...attachment })),
        references: input.references?.map((reference) => ({ ...reference })),
        ...(input.referenceContext ? { referenceContext: input.referenceContext } : {}),
        ...(input.goal === true ? { goal: true } : {}),
        createdAt: Date.now(),
      };
      queue.items.push(item);
      return cloneTurn(item);
    });
  }

  updateText(sessionId: string, itemId: string, text: string): QueuedChatTurn | null {
    return this.data.update((data) => {
      const queue = data.sessions[sessionId];
      if (!queue || activelyLeased(queue, itemId)) return null;
      const item = queue.items.find((candidate) => candidate.id === itemId);
      if (!item) return null;
      item.text = text;
      return cloneTurn(item);
    });
  }

  remove(sessionId: string, itemId: string): QueuedChatTurn | null {
    return this.data.update((data) => {
      const queue = data.sessions[sessionId];
      if (!queue) return null;
      if (activelyLeased(queue, itemId)) return null;
      const index = queue.items.findIndex((item) => item.id === itemId);
      if (index < 0) return null;
      const [removed] = queue.items.splice(index, 1);
      if (queue.lease?.itemId === itemId) queue.lease = undefined;
      if (queue.items.length === 0) delete data.sessions[sessionId];
      return removed ? cloneTurn(removed) : null;
    });
  }

  /**
   * Atomically remove one queued turn so another action can consume it without
   * racing the normal queue dispatcher. The caller must restore the extraction
   * if that action fails.
   */
  extract(sessionId: string, itemId: string): ExtractedQueuedChatTurn | null {
    return this.data.update((data) => {
      const queue = data.sessions[sessionId];
      if (!queue || activelyLeased(queue, itemId)) return null;
      const index = queue.items.findIndex((item) => item.id === itemId);
      if (index < 0) return null;
      const [item] = queue.items.splice(index, 1);
      if (!item) return null;
      const extracted = { item: cloneTurn(item), index, parked: queue.parked };
      if (!queue.items.length) delete data.sessions[sessionId];
      return extracted;
    });
  }

  /** Restore a failed extraction at its original position when still possible. */
  restore(extracted: ExtractedQueuedChatTurn): void {
    this.data.update((data) => {
      const { item, index, parked } = extracted;
      let queue = data.sessions[item.sessionId];
      if (!queue) {
        queue = { parked, items: [] };
        data.sessions[item.sessionId] = queue;
      }
      if (queue.items.some((candidate) => candidate.id === item.id)) return;
      queue.items.splice(Math.min(Math.max(0, index), queue.items.length), 0, cloneTurn(item));
    });
  }

  promote(sessionId: string, itemId: string): boolean {
    return this.data.update((data) => {
      const queue = data.sessions[sessionId];
      if (!queue) return false;
      if (activelyLeased(queue, itemId)) return false;
      const index = queue.items.findIndex((item) => item.id === itemId);
      if (index < 0) return false;
      const [item] = queue.items.splice(index, 1);
      if (item) queue.items.unshift(item);
      queue.parked = false;
      queue.lease = undefined;
      return true;
    });
  }

  parked(sessionId: string): boolean {
    return this.data.read().sessions[sessionId]?.parked === true;
  }

  setParked(sessionId: string, parked: boolean): void {
    this.data.update((data) => {
      const queue = data.sessions[sessionId];
      if (queue) {
        queue.parked = parked;
      }
    });
  }

  /** Atomically reserve the head turn so only one Attend process can dispatch it. */
  claim(sessionId: string, owner: string, leaseMs = 120_000): QueuedChatTurn | null {
    const now = Date.now();
    return this.data.update((data) => {
      const queue = data.sessions[sessionId];
      const item = queue?.items[0];
      if (!queue || queue.parked || !item) return null;
      if (queue.lease && queue.lease.expiresAt > now && queue.lease.owner !== owner) return null;
      queue.lease = {
        itemId: item.id,
        owner,
        expiresAt: now + Math.max(1_000, leaseMs),
      };
      return cloneTurn(item);
    });
  }

  completeClaim(sessionId: string, itemId: string, owner: string): QueuedChatTurn | null {
    return this.data.update((data) => {
      const queue = data.sessions[sessionId];
      if (!queue || queue.lease?.itemId !== itemId || queue.lease.owner !== owner) return null;
      const index = queue.items.findIndex((item) => item.id === itemId);
      if (index < 0) {
        queue.lease = undefined;
        return null;
      }
      const [removed] = queue.items.splice(index, 1);
      queue.lease = undefined;
      if (!queue.items.length) delete data.sessions[sessionId];
      return removed ? cloneTurn(removed) : null;
    });
  }

  releaseClaim(sessionId: string, itemId: string, owner: string): void {
    this.data.update((data) => {
      const queue = data.sessions[sessionId];
      if (queue?.lease?.itemId === itemId && queue.lease.owner === owner) queue.lease = undefined;
    });
  }

  /** Drop stale lease metadata without ever deleting a user's queued turn. */
  pruneExpiredLeases(now = Date.now()): number {
    return this.data.transact((data) => {
      let removed = 0;
      for (const queue of Object.values(data.sessions)) {
        if (queue.lease && queue.lease.expiresAt <= now) {
          queue.lease = undefined;
          removed += 1;
        }
      }
      return { result: removed, changed: removed > 0 };
    });
  }

  summary(): Record<string, { count: number; parked: boolean }> {
    return Object.fromEntries(
      Object.entries(this.data.read().sessions).map(([sessionId, queue]) => [
        sessionId,
        { count: queue.items.length, parked: queue.parked },
      ]),
    );
  }

  sessionIds(): string[] {
    return Object.keys(this.data.read().sessions);
  }
}
