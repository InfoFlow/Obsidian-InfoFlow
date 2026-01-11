// Inspired by Readwise Official plugin status bar queue behavior.
export interface StatusBarMessage {
  message: string;
  timeoutMs: number;
}

export class StatusBarQueue {
  private readonly statusBarEl: HTMLElement;
  private readonly messages: StatusBarMessage[] = [];
  private currentMessage: StatusBarMessage | null = null;
  private lastMessageTimestampMs: number | null = null;

  constructor(statusBarEl: HTMLElement) {
    this.statusBarEl = statusBarEl;
  }

  enqueue(message: string, timeoutSeconds: number, forcing: boolean = false) {
    const normalized = `infoflow: ${message.slice(0, 120)}`;
    if (this.messages[0]?.message === normalized) return;

    this.messages.push({ message: normalized, timeoutMs: timeoutSeconds * 1000 });

    if (forcing) {
      this.currentMessage = null;
      this.lastMessageTimestampMs = null;
      this.statusBarEl.setText("");
    }

    this.tick();
  }

  tick() {
    if (this.currentMessage) {
      const age = Date.now() - (this.lastMessageTimestampMs ?? 0);
      if (age >= this.currentMessage.timeoutMs) {
        this.currentMessage = null;
        this.lastMessageTimestampMs = null;
      } else {
        return;
      }
    }

    const next = this.messages.shift();
    if (!next) {
      this.statusBarEl.setText("");
      return;
    }

    this.currentMessage = next;
    this.statusBarEl.setText(next.message);
    this.lastMessageTimestampMs = Date.now();
  }
}

