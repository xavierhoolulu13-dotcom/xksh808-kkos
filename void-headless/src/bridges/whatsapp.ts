import { EventEmitter } from 'events';
import { NormalizedMessage, ChannelType } from '../types/protocols';

// WhatsApp bridge via webhook (Twilio / Meta Cloud API)
export class WhatsAppBridge extends EventEmitter {
  private webhookSecret: string;
  private phoneNumberId: string;
  private accessToken: string;

  constructor(config: {
    webhookSecret: string;
    phoneNumberId: string;
    accessToken: string;
  }) {
    super();
    this.webhookSecret = config.webhookSecret;
    this.phoneNumberId = config.phoneNumberId;
    this.accessToken = config.accessToken;
  }

  // Call this from your webhook handler (Netlify function or Express)
  processWebhook(payload: any): void {
    try {
      const entry = payload?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (!messages?.length) return;

      for (const msg of messages) {
        if (msg.type !== 'text') continue;

        const normalized: NormalizedMessage = {
          id: `wa-${msg.id}`,
          channel: 'whatsapp' as ChannelType,
          userId: msg.from,
          username: value?.contacts?.[0]?.profile?.name || msg.from,
          content: msg.text?.body || '',
          timestamp: parseInt(msg.timestamp) * 1000,
          raw: msg,
          metadata: {
            phoneNumberId: this.phoneNumberId,
          }
        };

        this.emit('message', normalized);
      }
    } catch (err) {
      this.emit('error', err);
    }
  }

  async send(to: string, text: string): Promise<void> {
    const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      throw new Error(`[WA Bridge] Send failed: ${res.status}`);
    }
  }

  async start(): Promise<void> {
    console.log('[WA Bridge] Online — webhook mode');
  }

  async stop(): Promise<void> {
    console.log('[WA Bridge] Stopped');
  }
}
