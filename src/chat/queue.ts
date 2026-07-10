import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ChatAttachment, UserTurn } from "./driver.js";

export interface QueuedChatTurn extends UserTurn {
  id: string;
  sessionId: string;
  cwd: string;
  vendor: string;
  createdAt: number;
  attachments?: ChatAttachment[];
}

interface SessionQueue {
  parked: boolean;
  items: QueuedChatTurn[];
}

interface QueueFile {
  sessions?: Record<string, SessionQueue>;
}

function cloneTurn(turn: QueuedChatTurn): QueuedChatTurn {
  return {
    ...turn,
    attachments: turn.attachments?.map((attachment) => ({ ...attachment })),
  };
}

/** Persistent, browser-independent queued turns, grouped by task session. */
export class ChatQueueStore {
  private sessions = new Map<string, SessionQueue>();

  constructor(private readonly file: string) {
    this.load();
  }

  list(sessionId: string): QueuedChatTurn[] {
    return (this.sessions.get(sessionId)?.items ?? []).map(cloneTurn);
  }

  peek(sessionId: string): QueuedChatTurn | null {
    const item = this.sessions.get(sessionId)?.items[0];
    return item ? cloneTurn(item) : null;
  }

  enqueue(
    sessionId: string,
    input: { cwd: string; vendor: string; text: string; attachments?: ChatAttachment[] },
  ): QueuedChatTurn {
    const queue = this.ensure(sessionId);
    const item: QueuedChatTurn = {
      id: crypto.randomUUID(),
      sessionId,
      cwd: input.cwd,
      vendor: input.vendor,
      text: input.text,
      attachments: input.attachments?.map((attachment) => ({ ...attachment })),
      createdAt: Date.now(),
    };
    queue.items.push(item);
    this.save();
    return cloneTurn(item);
  }

  updateText(sessionId: string, itemId: string, text: string): QueuedChatTurn | null {
    const item = this.sessions.get(sessionId)?.items.find((candidate) => candidate.id === itemId);
    if (!item) return null;
    item.text = text;
    this.save();
    return cloneTurn(item);
  }

  remove(sessionId: string, itemId: string): QueuedChatTurn | null {
    const queue = this.sessions.get(sessionId);
    if (!queue) return null;
    const index = queue.items.findIndex((item) => item.id === itemId);
    if (index < 0) return null;
    const [removed] = queue.items.splice(index, 1);
    this.cleanup(sessionId, queue);
    this.save();
    return removed ? cloneTurn(removed) : null;
  }

  promote(sessionId: string, itemId: string): boolean {
    const queue = this.sessions.get(sessionId);
    if (!queue) return false;
    const index = queue.items.findIndex((item) => item.id === itemId);
    if (index < 0) return false;
    const [item] = queue.items.splice(index, 1);
    if (item) queue.items.unshift(item);
    queue.parked = false;
    this.save();
    return true;
  }

  parked(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.parked === true;
  }

  setParked(sessionId: string, parked: boolean): void {
    const queue = this.sessions.get(sessionId);
    if (!queue) return;
    queue.parked = parked;
    this.cleanup(sessionId, queue);
    this.save();
  }

  summary(): Record<string, { count: number; parked: boolean }> {
    return Object.fromEntries(
      [...this.sessions.entries()]
        .filter(([, queue]) => queue.items.length > 0)
        .map(([sessionId, queue]) => [
          sessionId,
          { count: queue.items.length, parked: queue.parked },
        ]),
    );
  }

  sessionIds(): string[] {
    return [...this.sessions.keys()];
  }

  private ensure(sessionId: string): SessionQueue {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;
    const queue = { parked: false, items: [] };
    this.sessions.set(sessionId, queue);
    return queue;
  }

  private cleanup(sessionId: string, queue: SessionQueue): void {
    if (queue.items.length === 0) this.sessions.delete(sessionId);
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.file)) return;
      const raw = JSON.parse(fs.readFileSync(this.file, "utf-8")) as QueueFile;
      for (const [sessionId, queue] of Object.entries(raw.sessions ?? {})) {
        if (!Array.isArray(queue?.items) || queue.items.length === 0) continue;
        this.sessions.set(sessionId, {
          parked: queue.parked === true,
          items: queue.items
            .filter((item) => item?.id && item.sessionId === sessionId)
            .map(cloneTurn),
        });
      }
    } catch {
      this.sessions.clear();
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const sessions = Object.fromEntries(this.sessions);
    const tmp = `${this.file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify({ sessions }, null, 2));
    fs.renameSync(tmp, this.file);
  }
}
