export type AgentRole = 'router' | 'summarizer' | 'forwarder' | 'observer' | 'lead' | 'sales' | 'delivery' | 'retention' | 'monitor';

export type AgentStatus = 'idle' | 'running' | 'error' | 'paused';

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  systemPrompt: string;
  model: string;
  maxTokens: number;
  temperature: number;
  channels: string[];
  triggers: AgentTrigger[];
}

export interface AgentTrigger {
  type: 'message' | 'schedule' | 'event' | 'webhook';
  pattern?: string;
  cron?: string;
  event?: string;
}

export interface AgentMessage {
  id: string;
  agentId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  channel: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface AgentState {
  id: string;
  config: AgentConfig;
  status: AgentStatus;
  lastRun: number;
  messageCount: number;
  errorCount: number;
}
