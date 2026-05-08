export type Capability =
  | 'read_messages'
  | 'send_messages'
  | 'manage_leads'
  | 'manage_clients'
  | 'process_payments'
  | 'deploy_sites'
  | 'manage_agents'
  | 'admin';

export interface CapabilityPolicy {
  agentId: string;
  capabilities: Capability[];
  channels: string[];
  rateLimit?: RateLimit;
}

export interface RateLimit {
  maxMessages: number;
  windowSeconds: number;
}
