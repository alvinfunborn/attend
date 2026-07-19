import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ScheduleStore,
  type ScheduledMessagePayload,
  type ScheduledSessionPayload,
} from "../src/core/schedules.js";

function store(): ScheduleStore {
  return new ScheduleStore(
    path.join(os.tmpdir(), `attend-schedules-${Date.now()}-${Math.random()}.sqlite3`),
  );
}

function message(text = "later"): ScheduledMessagePayload {
  return {
    kind: "message",
    sessionId: "session-1",
    cwd: os.tmpdir(),
    vendor: "claude",
    text,
  };
}

describe("ScheduleStore", () => {
  it("persists and edits a one-time run independently from its job", () => {
    const schedules = store();
    const firstAt = Date.now() + 60_000;
    const created = schedules.create(message(), firstAt, "Asia/Shanghai");

    expect(created.jobId).not.toBe(created.id);
    expect(created.status).toBe("scheduled");
    expect(schedules.list()).toEqual([created]);

    const nextAt = firstAt + 60_000;
    const updated = schedules.update(created.id, { runAt: nextAt, text: "updated" });
    expect(updated?.runAt).toBe(nextAt);
    expect(updated?.payload.text).toBe("updated");
    expect(updated?.jobId).toBe(created.jobId);
    schedules.close();
  });

  it("claims a due run once and records its dispatch id", () => {
    const schedules = store();
    const due = schedules.create(message(), Date.now() - 1, "UTC");

    expect(schedules.claimDue("other", () => false)).toBeNull();
    const claimed = schedules.claimDue("worker-1", () => true);
    expect(claimed?.id).toBe(due.id);
    expect(claimed?.status).toBe("claimed");
    expect(schedules.claimDue("worker-2", () => true)).toBeNull();

    const completed = schedules.complete(due.id, "worker-1", "queue-1");
    expect(completed?.status).toBe("dispatched");
    expect(completed?.dispatchId).toBe("queue-1");
    expect(schedules.list()).toEqual([]);
    schedules.close();
  });

  it("claims the exact due run selected by Run now", () => {
    const schedules = store();
    const first = schedules.create(message("first"), Date.now() - 2_000, "UTC");
    const selected = schedules.create(message("selected"), Date.now() - 1_000, "UTC");

    expect(schedules.claim(selected.id, "run-now")?.status).toBe("claimed");
    expect(schedules.get(first.id)?.status).toBe("scheduled");
    expect(schedules.claim(selected.id, "another-owner")).toBeNull();
    schedules.close();
  });

  it("retargets a future session opener after the placeholder starts early", () => {
    const schedules = store();
    const payload: ScheduledSessionPayload = {
      kind: "session",
      mode: "fork",
      clientSessionId: "scheduled-branch",
      parentSessionId: "parent-1",
      cwd: os.tmpdir(),
      vendor: "codex",
      text: "original future turn",
      attachments: [],
      contextMessages: [{ role: "user", text: "frozen context" }],
    };
    const runAt = Date.now() + 60_000;
    const created = schedules.create(payload, runAt, "UTC");

    expect(schedules.claimForMaterialization(created.id, "early")?.status).toBe("claimed");
    const retargeted = schedules.retargetMaterializedSession(created.id, "early", "provider-1");

    expect(retargeted).toMatchObject({
      id: created.id,
      jobId: created.jobId,
      kind: "message",
      runAt,
      status: "scheduled",
      payload: {
        kind: "message",
        sessionId: "provider-1",
        text: "original future turn",
      },
    });
    expect(retargeted?.payload).not.toHaveProperty("contextMessages");
    schedules.close();
  });

  it("makes an expired dispatch lease explicit instead of risking a duplicate", () => {
    const schedules = store();
    const due = schedules.create(message(), Date.now() - 1, "UTC");
    schedules.claimDue("worker", () => true, Date.now(), 1);

    expect(schedules.markExpiredClaimsUncertain(Date.now() + 10)).toBe(1);
    const uncertain = schedules.get(due.id);
    expect(uncertain?.status).toBe("uncertain");
    expect(uncertain?.error).toContain("Review and retry");

    expect(schedules.update(due.id, { runAt: Date.now() + 60_000 })?.status).toBe("scheduled");
    expect(schedules.cancel(due.id)?.status).toBe("cancelled");
    expect(schedules.list()).toEqual([]);
    schedules.close();
  });
});
