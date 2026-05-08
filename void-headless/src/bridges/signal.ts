import { EventEmitter } from 'events';
import { NormalizedMessage, ChannelType } from '../types/protocols';

// Signal bridge via signal-cli REST API
export class SignalBridge extends EventEmitter {
  private apiUrl: string;
  private account: string;

  constructor(apiUrl: string, account: string) {
    super();
    this.apiUrl = apiUrl;
    this.account = account;
  }

  async poll(): Promise<void> {
    try {
      const res = await fetch(`${this.apiUrl}/v1/receive/${this.account}`);
      const messages = await res.json() as any[];

      for (const item of messages) {
        const msg = item?.envelope?.dataMessage;
        if (!msg?.message) continue;

        const normalized: NormalizedMessage = {
          id: `sig-${item.envelope.timestamp}`,
          channel: 'signal' as ChannelType,
          userId: item.envelope.sourceNumber || item.envelope.sourceUuid,
          username: item.envelope.sourceName || 'unknown',
          content: msg.message,
          timestamp: item.envelope.timestamp,
          raw: item,
        };

        this.emit('message', normalized);
      }
    } catch (err) {
      this.emit('error', err);
    }
  }

  async send(recipient: string, text: string): Promise<void> {
    await fetch(`${this.apiUrl}/v2/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        number: this.account,
        recipients: [recipient]
      })
    });
  }

  async start(): Promise<void> {
    console.log('[Signal Bridge] Online — polling mode');
    setInterval(() => this.poll(), 5000);
  }

  async stop(): Promise<void> {
    console.log('[Signal Bridge] Stopped');
  }
}
