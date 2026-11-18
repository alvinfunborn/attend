import fs from "node:fs";

export const SEARCH_READ_BLOCK_BYTES = 64 * 1024;
export const SEARCH_MAX_RECORD_BYTES = 32 * 1024 * 1024;

/** Read only the captured file version. Byte offsets also survive split UTF-8
 * characters and incomplete records written by a still-running CLI. Oversized
 * records fail explicitly instead of allocating an unbounded JSON string. */
export function* readSearchLines(
  fd: number,
  start: number,
  end: number,
): Generator<{ text: string; start: number; end: number; complete: boolean }> {
  const block = Buffer.allocUnsafe(SEARCH_READ_BLOCK_BYTES);
  let position = start;
  let lineStart = start;
  let parts: Buffer[] = [];
  let length = 0;
  while (position < end) {
    const n = fs.readSync(fd, block, 0, Math.min(block.length, end - position), position);
    if (!n) throw new Error("Transcript truncated while indexing; retry search");
    let from = 0;
    while (from < n) {
      const newline = block.indexOf(10, from);
      const complete = newline >= 0 && newline < n;
      const to = complete ? newline : n;
      const part = block.subarray(from, to);
      length += part.length;
      if (length > SEARCH_MAX_RECORD_BYTES) {
        throw new Error("Search transcript record exceeds the 32 MiB safety limit");
      }
      if (part.length) parts.push(Buffer.from(part));
      if (complete) {
        const next = position + to + 1;
        yield {
          text: Buffer.concat(parts, length).toString("utf8"),
          start: lineStart,
          end: next,
          complete: true,
        };
        lineStart = next;
        parts = [];
        length = 0;
      }
      from = to + (complete ? 1 : 0);
    }
    position += n;
  }
  if (length) {
    yield {
      text: Buffer.concat(parts, length).toString("utf8"),
      start: lineStart,
      end: position,
      complete: false,
    };
  }
}
