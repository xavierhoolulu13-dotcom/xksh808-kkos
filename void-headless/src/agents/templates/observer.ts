import { NormalizedMessage } from '../../types/protocols';
import { EventEmitter } from 'events';

// RSIS808 — Error Daemon + Observer
export class ObserverAgent extends EventEmitter {
  private log: Array<{ ts: number; channel: string; event: string; data: unknown }> = [];

  observe(msg: NormalizedMessage, event: string): void {
    const entry = { ts: Date.now(), channel: msg.channel, event, data: msg };
    this.log.push(entry);
    if (event === 'spam' || event === 'error') {
      console.warn(`[RSIS808] ⚠️  ${event} detected on ${msg.channel} from ${msg.username}`);
      this.emit('alert', entry);
    }
  }

  getLog(limit = 100): typeof this.log {
    return this.log.slice(-limit);
  }

  clearLog(): void {
    this.log = [];
  }
}
