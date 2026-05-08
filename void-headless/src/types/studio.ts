export interface StudioEnvironment {
  id: string;
  name: string;
  type: 'tg-bot-server' | 'marketing-studio' | 'dev-sandbox' | 'custom';
  status: 'active' | 'paused' | 'error' | 'building';
  agents: string[];
  bridges: string[];
  config: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface StudioTemplate {
  id: string;
  name: string;
  description: string;
  agents: string[];
  bridges: string[];
  defaultConfig: Record<string, unknown>;
}
