import { NormalizedMessage } from '../../types/protocols';
import { EventEmitter } from 'events';

// Cross-channel forwarder — mirrors messages between bridges
export class ForwarderAgent extends EventEmitter {
  private rules: Array<{ from: string; to: string[]; filter?: (m: NormalizedMessage) => boolean }> = [];

  addRule(from: string, to: string[], filter?: (m: NormalizedMessage) => boolean): void {
    this.rules.push({ from, to, filter });
  }

  forward(msg: NormalizedMessage): void {
    for (const rule of this.rules) {
      if (rule.from !== msg.channel) continue;
      if (rule.filter && !rule.filter(msg)) continue;

      for (const target of rule.to) {
        this.emit('forward', { target, message: msg });
        console.log(`[Forwarder] ${msg.channel} → ${target}: ${msg.content.slice(0, 50)}`);
      }
    }
  }
}
