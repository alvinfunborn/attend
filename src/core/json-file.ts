import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type Normalizer<T> = (value: unknown) => T;
const LOCK_SLEEP = new Int32Array(new SharedArrayBuffer(4));
const LOCK_TIMEOUT_MS = 10_000;
const STALE_LOCK_MS = 60_000;

interface LockOwner {
  token: string;
  pid: number;
  hostname: string;
  createdAt: number;
}

export interface JsonTransaction<R> {
  result: R;
  changed: boolean;
}

export interface JsonRepository<T> {
  read(): T;
  update<R>(mutate: (value: T) => R): R;
  transact<R>(mutate: (value: T) => JsonTransaction<R>): R;
}

export interface JsonTransactionOptions {
  lockTimeoutMs?: number;
}

export class JsonFileLockTimeoutError extends Error {
  constructor(readonly file: string) {
    super(`timed out locking ${file}`);
    this.name = "JsonFileLockTimeoutError";
  }
}

/**
 * Small synchronous JSON repository for the state stores used on request paths.
 *
 * Reads are signature-cached, but every mutation reloads while holding a
 * cross-process lock. Writes use fsync + rename so another Attend process can
 * never observe a partial document and sequential writers merge instead of
 * replacing one another's in-memory snapshot.
 */
export class JsonFile<T> {
  private value: T;
  private signature: string | null | undefined;

  constructor(
    private readonly file: string,
    private readonly normalize: Normalizer<T>,
  ) {
    this.value = normalize(undefined);
  }

  read(): T {
    const signature = this.fileSignature();
    if (this.signature === undefined || signature !== this.signature) {
      this.value = this.readDisk();
      this.signature = signature;
    }
    return this.value;
  }

  update<R>(mutate: (value: T) => R): R {
    return this.transact((value) => ({ result: mutate(value), changed: true }));
  }

  /** Run under the same lock but skip fsync/rename when the mutation found no work. */
  transact<R>(mutate: (value: T) => JsonTransaction<R>, opts: JsonTransactionOptions = {}): R {
    return this.withLock(() => {
      const value = this.readDisk();
      const transaction = mutate(value);
      if (transaction.changed) this.writeDisk(value);
      this.value = value;
      this.signature = this.fileSignature();
      return transaction.result;
    }, opts.lockTimeoutMs);
  }

  private readDisk(): T {
    try {
      return this.normalize(JSON.parse(fs.readFileSync(this.file, "utf-8")));
    } catch {
      return this.normalize(undefined);
    }
  }

  private writeDisk(value: T): void {
    const dir = path.dirname(this.file);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmp = path.join(
      dir,
      `.${path.basename(this.file)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`,
    );
    let fd: number | undefined;
    try {
      fd = fs.openSync(tmp, "wx", 0o600);
      fs.writeFileSync(fd, JSON.stringify(value, null, 2));
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = undefined;
      fs.renameSync(tmp, this.file);
      try {
        const dirFd = fs.openSync(dir, "r");
        try {
          fs.fsyncSync(dirFd);
        } finally {
          fs.closeSync(dirFd);
        }
      } catch {
        // Directory fsync is not supported on every platform/filesystem.
      }
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      try {
        fs.unlinkSync(tmp);
      } catch {
        // The rename already consumed it, or creation failed.
      }
    }
  }

  private fileSignature(): string | null {
    try {
      const stat = fs.statSync(this.file);
      return `${stat.dev}:${stat.ino}:${stat.mtimeMs}:${stat.size}`;
    } catch {
      return null;
    }
  }

  private withLock<R>(operation: () => R, timeoutMs = LOCK_TIMEOUT_MS): R {
    const lock = `${this.file}.lock`;
    const ownerFile = path.join(lock, "owner.json");
    const owner: LockOwner = {
      token: `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      pid: process.pid,
      hostname: os.hostname(),
      createdAt: Date.now(),
    };
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const deadline = Date.now() + Math.max(0, timeoutMs);
    let waitMs = 5;
    while (true) {
      try {
        fs.mkdirSync(lock, { mode: 0o700 });
        try {
          fs.writeFileSync(ownerFile, JSON.stringify(owner), { mode: 0o600 });
        } catch (error) {
          fs.rmSync(lock, { recursive: true, force: true });
          throw error;
        }
        break;
      } catch (error) {
        if (!isAlreadyExists(error)) throw error;
        if (this.removeStaleLock(lock)) continue;
        if (Date.now() >= deadline) throw new JsonFileLockTimeoutError(this.file);
        Atomics.wait(LOCK_SLEEP, 0, 0, waitMs);
        waitMs = Math.min(50, Math.ceil(waitMs * 1.5));
      }
    }
    try {
      return operation();
    } finally {
      try {
        const current = this.readLockOwner(ownerFile);
        if (current?.token === owner.token) fs.rmSync(lock, { recursive: true, force: true });
      } catch {
        // A stale-lock cleaner may already have removed it.
      }
    }
  }

  private removeStaleLock(lock: string): boolean {
    try {
      const owner = this.readLockOwner(path.join(lock, "owner.json"));
      if (owner?.hostname === os.hostname()) {
        if (processExists(owner.pid)) return false;
        fs.rmSync(lock, { recursive: true, force: true });
        return true;
      }
      if (Date.now() - fs.statSync(lock).mtimeMs < STALE_LOCK_MS) return false;
      fs.rmSync(lock, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  private readLockOwner(file: string): LockOwner | undefined {
    try {
      const value = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (
        typeof value?.token === "string" &&
        Number.isInteger(value?.pid) &&
        value.pid > 0 &&
        typeof value?.hostname === "string"
      ) {
        return value as LockOwner;
      }
    } catch {
      // A writer may have exited between creating the directory and owner file.
    }
    return undefined;
  }
}

function isAlreadyExists(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "EEXIST";
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !!error && typeof error === "object" && "code" in error && error.code === "EPERM";
  }
}
