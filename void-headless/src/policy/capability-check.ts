import { PolicyEngine } from './policy-engine';
import { Capability } from '../types/capabilities';

export function requireCapability(
  engine: PolicyEngine,
  agentId: string,
  cap: Capability
): void {
  if (!engine.hasCapability(agentId, cap)) {
    throw new Error(`[RSIS808] Agent ${agentId} lacks capability: ${cap}`);
  }
}

export function guardRateLimit(engine: PolicyEngine, agentId: string): void {
  if (!engine.checkRateLimit(agentId)) {
    throw new Error(`[RSIS808] Rate limit exceeded for agent: ${agentId}`);
  }
}
