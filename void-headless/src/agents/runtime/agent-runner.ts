import OpenAI from 'openai';
import { AgentConfig, AgentMessage, AgentState } from '../../types/agents';
import { NormalizedMessage } from '../../types/protocols';
import { ActuatorEngine } from './actuator-engine';
import { EventEmitter } from 'events';

export class AgentRunner extends EventEmitter {
  private openai: OpenAI;
  private config: AgentConfig;
  private state: AgentState;
  private actuator: ActuatorEngine;
  private history: AgentMessage[] = [];

  constructor(config: AgentConfig, apiKey: string, actuator: ActuatorEngine) {
    super();
    this.config = config;
    this.actuator = actuator;
    this.openai = new OpenAI({ apiKey });
    this.state = {
      id: config.id,
      config,
      status: 'idle',
      lastRun: 0,
      messageCount: 0,
      errorCount: 0,
    };
  }

  async process(msg: NormalizedMessage): Promise<string> {
    this.state.status = 'running';
    this.state.lastRun = Date.now();
    this.state.messageCount++;

    try {
      const messages: any[] = [
        { role: 'system', content: this.config.systemPrompt },
        ...this.history.slice(-10).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: `[Channel: ${msg.channel}] [User: ${msg.username}] ${msg.content}` }
      ];

      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });

      const response = completion.choices[0]?.message?.content || '';

      this.history.push(
        { id: msg.id, agentId: this.config.id, role: 'user', content: msg.content, channel: msg.channel, timestamp: msg.timestamp },
        { id: `${msg.id}-r`, agentId: this.config.id, role: 'assistant', content: response, channel: msg.channel, timestamp: Date.now() }
      );

      this.state.status = 'idle';
      return response;

    } catch (err: any) {
      this.state.status = 'error';
      this.state.errorCount++;
      this.emit('error', { agentId: this.config.id, error: err.message });
      throw err;
    }
  }

  getState(): AgentState {
    return { ...this.state };
  }

  clearHistory(): void {
    this.history = [];
  }
}
