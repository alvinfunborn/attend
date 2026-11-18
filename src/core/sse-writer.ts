interface Frame {
  data: string;
  id: string;
}

/** An ordered, disposable queue. Slow connections resync instead of retaining
 * an unbounded promise chain containing every event emitted while offline. */
export class BoundedSseWriter {
  private pending: Array<Frame & { bytes: number }> = [];
  private bytes = 0;
  private count = 0;
  private writing = false;
  private closed = false;

  constructor(
    private readonly write: (frame: Frame) => Promise<unknown>,
    private readonly disconnect: () => void,
    private readonly maxBytes = 4 * 1024 * 1024,
    // A reconnect synchronously enqueues up to 2,000 replay events plus its
    // handshake, before the first write can settle.
    private readonly maxFrames = 4096,
  ) {}

  send(frame: Frame): void {
    if (this.closed) return;
    const bytes = Buffer.byteLength(frame.data) + frame.id.length + 32;
    if (this.bytes + bytes > this.maxBytes || this.count >= this.maxFrames) {
      this.close();
      this.disconnect();
      return;
    }
    this.bytes += bytes;
    this.count++;
    this.pending.push({ ...frame, bytes });
    void this.drain();
  }

  close(): void {
    this.closed = true;
    this.pending = [];
    this.bytes = 0;
    this.count = 0;
  }

  private async drain(): Promise<void> {
    if (this.writing || this.closed) return;
    this.writing = true;
    try {
      while (!this.closed) {
        const frame = this.pending.shift();
        if (!frame) break;
        await this.write({ data: frame.data, id: frame.id });
        if (!this.closed) {
          this.bytes -= frame.bytes;
          this.count--;
        }
      }
    } catch {
      if (!this.closed) {
        this.close();
        this.disconnect();
      }
    } finally {
      this.writing = false;
    }
  }
}
