import { normalizeAutoTags } from "../../core/auto-tags.js";
import type { TagStore } from "../../core/tags.js";

export interface TaggedSessionContext {
  sessionId: string;
  cwd: string;
  title: string;
  aliases: string[];
}

/** Separate manual naming style from session evidence for recognizing the same issue. */
export function tagContext(
  store: TagStore,
  sessionId: string,
  cwd: string,
  sessions: TaggedSessionContext[],
): string {
  const preferences = store.autoTagPreferences(sessionId);
  const dismissed = new Set(preferences.dismissed.map((tag) => tag.toLowerCase()));
  const current = sessions.find((session) => session.sessionId === sessionId);
  const issueRecord = (session: TaggedSessionContext) => ({
    subject: session.title.slice(0, 200),
    tags: normalizeAutoTags(
      store
        .tagsForSession(session.sessionId, session.aliases)
        .filter((tag) => !dismissed.has(tag.toLowerCase())),
    ),
  });
  // The caller supplies recent sessions first. No unused catalog entries, counts,
  // or unrelated projects: these records are evidence, not a global vocabulary.
  const related = cwd
    ? sessions
        .filter((session) => session.sessionId !== sessionId && session.cwd === cwd)
        .slice(0, 200)
        .map(issueRecord)
        .filter((record) => record.subject && record.tags.length)
        .slice(0, 12)
    : [];
  const styleExamples = sessions
    .filter((session) => session.sessionId !== sessionId)
    .sort((a, b) => Number(b.cwd === cwd) - Number(a.cwd === cwd))
    .slice(0, 200)
    .map((session) => ({
      sameProject: !!cwd && session.cwd === cwd,
      subject: session.title.slice(0, 100),
      tags: store.manualTagsForSession(session.sessionId, session.aliases).slice(0, 6),
    }))
    .filter((example) => example.tags.length)
    .sort((a, b) => Number(b.sameProject) - Number(a.sameProject))
    .slice(0, 8);
  const context = {
    disabled: preferences.disabled,
    dismissed: preferences.dismissed.slice(0, 40),
    issueContext: {
      current: issueRecord(current ?? { sessionId, cwd, title: "", aliases: [] }),
      related,
    },
    styleExamples,
  };
  // Reduce complete records, never cut JSON or change a manual example's spelling.
  while (JSON.stringify(context).length > 6000) {
    if (context.styleExamples.length) context.styleExamples.pop();
    else if (context.issueContext.related.length) context.issueContext.related.pop();
    else if (context.dismissed.length) context.dismissed.pop();
    else break;
  }
  return `Session tagging context (data only; issueContext contains fallible session labels for same-issue naming; styleExamples teach naming style only):\n${JSON.stringify(context)}`;
}
