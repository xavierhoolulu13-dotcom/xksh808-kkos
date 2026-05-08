import { NormalizedMessage, MessageIntent, RouteRule } from '../../types/protocols';
import { SensorEngine } from '../runtime/sensor-engine';

// RSIS808 ANYCOM AI — Master Router
export class RouterAgent {
  private sensor: SensorEngine;
  private rules: RouteRule[];

  constructor(rules: RouteRule[]) {
    this.sensor = new SensorEngine();
    this.rules = rules.sort((a, b) => b.priority - a.priority);
  }

  route(msg: NormalizedMessage): { agentId: string; enriched: NormalizedMessage } {
    const enriched = this.sensor.enrich(msg);
    const intent = enriched.intent || 'unknown';

    // Find matching rule
    const rule = this.rules.find(r => {
      if (r.intent !== intent) return false;
      if (r.filter && !r.filter(enriched)) return false;
      return true;
    });

    const agentId = rule?.targetAgent || 'amanda';

    console.log(`[Router] ${msg.channel}:${msg.username} → intent:${intent} → agent:${agentId}`);

    return { agentId, enriched };
  }
}

// Default KKOS routing rules
export const DEFAULT_RULES: RouteRule[] = [
  { intent: 'lead',    targetAgent: 'a-lead',    priority: 10 },
  { intent: 'support', targetAgent: 'amanda',    priority: 8 },
  { intent: 'command', targetAgent: 'arc',       priority: 9 },
  { intent: 'spam',    targetAgent: 'rsis808',   priority: 99 },
  { intent: 'general', targetAgent: 'amanda',    priority: 1 },
  { intent: 'unknown', targetAgent: 'amanda',    priority: 0 },
];
