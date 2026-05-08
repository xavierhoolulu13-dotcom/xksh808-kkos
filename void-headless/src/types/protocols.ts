export type ChannelType = 'telegram' | 'discord' | 'whatsapp' | 'signal' | 'matterbridge';

export interface NormalizedMessage {
  id: string;
  channel: ChannelType;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
  raw: unknown;
  intent?: MessageIntent;
  metadata?: Record<string, unknown>;
}

export type MessageIntent = 'lead' | 'support' | 'command' | 'general' | 'spam' | 'unknown';

export interface BridgeConfig {
  type: ChannelType;
  enabled: boolean;
  token?: string;
  webhookUrl?: string;
  channelId?: string;
  guildId?: string;
  options?: Record<string, unknown>;
}

export interface RouteRule {
  intent: MessageIntent;
  targetAgent: string;
  priority: number;
  filter?: (msg: NormalizedMessage) => boolean;
}
