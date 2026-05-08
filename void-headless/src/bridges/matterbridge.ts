import { EventEmitter } from 'events';
import { NormalizedMessage, ChannelType } from '../types/protocols';
import WebSocket from 'ws';

// Matterbridge WebSocket bridge
export class MatterbridgeBridge extends EventEmitter {
  private wsUrl: string;
  private ws?: WebSocket;

  constructor(wsUrl: string) {
    super();
    this.wsUrl = wsUrl;
  }

  async start(): Promise<void> {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      console.log('[Matterbridge] Connected');
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const payload = JSON.parse(data.toString());
        const normalized: NormalizedMessage = {
          id: `mb-${Date.now()}`,
          channel: 'matterbridge' as ChannelType,
          userId: payload.userid || 'unknown',
          username: payload.username || 'unknown',
          content: payload.text || '',
          timestamp: Date.now(),
          raw: payload,
          metadata: {
            gateway: payload.gateway,
            protocol: payload.protocol,
          }
        };
        this.emit('message', normalized);
      } catch (err) {
        this.emit('error', err);
      }
    });

    this.ws.on('error', (err) => this.emit('error', err));
    this.ws.on('close', () => console.log('[Matterbridge] Disconnected'));
  }

  async send(gateway: string, text: string): Promise<void> {
    if (!this.ws) return;
    this.ws.send(JSON.stringify({ gateway, text }));
  }

  async stop(): Promise<void> {
    this.ws?.close();
  }
}
