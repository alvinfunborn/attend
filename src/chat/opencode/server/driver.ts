import { ProcessChatDriver } from "../../process/driver.js";
import type { ProviderErrorClassifier } from "../../provider-errors.js";
import type { OpencodeServerLike } from "./client.js";
import { makeOpencodeServerExec } from "./exec.js";

/**
 * OpenCode chat over one persistent `opencode serve` process owned by Attend.
 * Turns are submitted through the server API instead of spawning `opencode run`
 * per turn, so an interrupted or crashed Attend can never leave a detached CLI
 * loop writing turns into the same session — the server is a single child that
 * dies with its parent (and is reaped from its pid file if it did not).
 */
export class OpencodeServerDriver extends ProcessChatDriver {
  private readonly server: OpencodeServerLike;

  constructor(server: OpencodeServerLike, classifyError?: ProviderErrorClassifier) {
    super(
      makeOpencodeServerExec(server),
      "danger-full-access",
      () => null,
      "opencode",
      classifyError,
    );
    this.server = server;
  }

  override shutdown(): void {
    super.shutdown();
    this.server.shutdown();
  }
}
