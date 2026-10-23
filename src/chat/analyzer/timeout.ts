const DEFAULT_ANALYZER_TIMEOUT_MS = 120_000;

/** Consume one analyzer stream under a single wall-clock deadline. */
export async function consumeAnalyzerStream<T>(
  source: AsyncIterable<T>,
  visit: (value: T) => void,
  stop: () => unknown,
  timeoutMs = DEFAULT_ANALYZER_TIMEOUT_MS,
  signal?: AbortSignal,
): Promise<void> {
  const iterator = source[Symbol.asyncIterator]();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`analyzer timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    timer.unref?.();
  });
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal?.reason ?? new Error("analyzer canceled"));
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
  try {
    if (signal?.aborted) await aborted;
    while (true) {
      const next = await Promise.race([iterator.next(), timeout, aborted]);
      if (next.done) return;
      visit(next.value);
    }
  } catch (error) {
    void Promise.resolve(stop()).catch(() => {});
    void Promise.resolve(iterator.return?.()).catch(() => {});
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    if (onAbort) signal?.removeEventListener("abort", onAbort);
  }
}
