import { NormalizedMessage, MessageIntent } from '../types/protocols';
import { CapabilityPolicy, Capability } from '../types/capabilities';

export class PolicyEngine {
  private policies: Map<string, CapabilityPolicy> = new Map();
  private rateLimitCounters: Map<string, { count: number; resetAt: number }> = new Map();

  registerPolicy(policy: CapabilityPolicy): void {
    this.policies.set(policy.agentId, policy);
  }

  hasCapability(agentId: string, cap: Capability): boolean {
    const policy = this.policies.get(agentId);
    return policy?.capabilities.includes(cap) ?? false;
  }

  checkRateLimit(agentId: string): boolean {
    const policy = this.policies.get(agentId);
    if (!policy?.rateLimit) return true;

    const key = agentId;
    const now = Date.now();
    const counter = this.rateLimitCounters.get(key);

    if (!counter || now > counter.resetAt) {
      this.rateLimitCounters.set(key, {
        count: 1,
        resetAt: now + policy.rateLimit.windowSeconds * 1000
      });
      return true;
    }

    if (counter.count >= policy.rateLimit.maxMessages) return false;
    counter.count++;
    return true;
  }
}
