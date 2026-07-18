export type InteractionKind = "question" | "approval" | "form" | "client_action";

export interface PendingInteraction<Answer> {
  id: string;
  requestId: string | number;
  kind: InteractionKind;
  answer(answer: Answer): void;
  cancel(): void;
}

/**
 * Vendor-neutral registry for server-initiated requests that need a client
 * response. Adapters own the wire-format mapping; the broker owns the crucial
 * lifecycle invariant that every accepted request is answered or cancelled.
 */
export class InteractionBroker<Answer> {
  private readonly pending = new Map<string, PendingInteraction<Answer>>();

  open(interaction: PendingInteraction<Answer>): boolean {
    if (this.pending.has(interaction.id)) return false;
    this.pending.set(interaction.id, interaction);
    return true;
  }

  answer(id: string, answer: Answer): boolean {
    const interaction = this.pending.get(id);
    if (!interaction) return false;
    this.pending.delete(id);
    interaction.answer(answer);
    return true;
  }

  cancelAll(): number {
    const interactions = [...this.pending.values()];
    this.pending.clear();
    for (const interaction of interactions) {
      try {
        interaction.cancel();
      } catch {
        // A transport may already be gone during shutdown. The local registry
        // must still be drained so a dead request cannot keep a session active.
      }
    }
    return interactions.length;
  }

  get size(): number {
    return this.pending.size;
  }
}
