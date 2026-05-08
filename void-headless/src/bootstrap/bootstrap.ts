import { TelegramBridge } from '../bridges/telegram';
import { DiscordBridge } from '../bridges/discord';
import { WhatsAppBridge } from '../bridges/whatsapp';
import { RouterAgent, DEFAULT_RULES } from '../agents/templates/router';
import { ObserverAgent } from '../agents/templates/observer';
import { ForwarderAgent } from '../agents/templates/forwarder';
import { AgentRunner } from '../agents/runtime/agent-runner';
import { ActuatorEngine } from '../agents/runtime/actuator-engine';
import { NormalizedMessage } from '../types/protocols';

export interface BootstrapConfig {
  telegram?: { token: string };
  discord?: { token: string; watchChannels?: string[] };
  whatsapp?: { webhookSecret: string; phoneNumberId: string; accessToken: string };
  openai: { apiKey: string };
  operatorChatId?: string;
}

export class VoidHeadlessBootstrap {
  private router: RouterAgent;
  private observer: ObserverAgent;
  private forwarder: ForwarderAgent;
  private actuator: ActuatorEngine;
  private agents: Map<string, AgentRunner> = new Map();

  public tg?: TelegramBridge;
  public discord?: DiscordBridge;
  public whatsapp?: WhatsAppBridge;

  constructor(private config: BootstrapConfig) {
    this.router = new RouterAgent(DEFAULT_RULES);
    this.observer = new ObserverAgent();
    this.forwarder = new ForwarderAgent();
    this.actuator = new ActuatorEngine();

    this.setupActuator();
    this.setupAgents();
    this.setupForwarder();
  }

  private setupAgents(): void {
    // AMANDA — Public-facing client agent
    this.agents.set('amanda', new AgentRunner({
      id: 'amanda',
      name: 'AMANDA',
      role: 'router',
      systemPrompt: `You are AMANDA, the public-facing AI agent for XKSH808 Digital Services Hawaii. You help local Hawaii businesses with websites, SEO, and digital marketing. You are warm, confident, and close. When someone shows interest, collect their name, business, and phone number. Keep responses short and mobile-friendly.`,
      model: 'gpt-4o-mini',
      maxTokens: 300,
      temperature: 0.7,
      channels: ['telegram', 'discord', 'whatsapp'],
      triggers: [{ type: 'message' }]
    }, config.openai.apiKey, this.actuator));

    // A_LEAD — Lead qualification agent
    this.agents.set('a-lead', new AgentRunner({
      id: 'a-lead',
      name: 'A_LEAD',
      role: 'lead',
      systemPrompt: `You are A_LEAD, the lead qualification engine for XKSH808. Your job is to score, qualify, and engage inbound leads from Hawaii local businesses. Ask about their current website, what they need, and their budget. Score them Hot/Warm/Cold. Always end with a clear next step.`,
      model: 'gpt-4o-mini',
      maxTokens: 400,
      temperature: 0.5,
      channels: ['telegram', 'discord', 'whatsapp'],
      triggers: [{ type: 'message', pattern: 'lead' }]
    }, config.openai.apiKey, this.actuator));

    // ARC — Operator command agent
    this.agents.set('arc', new AgentRunner({
      id: 'arc',
      name: 'ARC',
      role: 'router',
      systemPrompt: `You are ARC, the internal operator co-pilot for XKSH808. You help Xavier manage the KKOS system. You can run reports, check lead status, trigger workflows, and manage agents. Be direct and technical. Xavier is the operator — give him full system control.`,
      model: 'gpt-4o-mini',
      maxTokens: 600,
      temperature: 0.3,
      channels: ['telegram'],
      triggers: [{ type: 'message', pattern: 'command' }]
    }, config.openai.apiKey, this.actuator));
  }

  private setupActuator(): void {
    this.actuator.on('notify', (payload: any) => {
      if (this.config.operatorChatId && this.tg) {
        this.tg.send(this.config.operatorChatId, `🔴 KKOS ALERT:\n${JSON.stringify(payload, null, 2)}`);
      }
    });

    this.actuator.on('lead', (payload: any) => {
      console.log('[KKOS] New lead captured:', payload);
    });
  }

  private setupForwarder(): void {
    // Forward leads from Discord → Telegram operator
    this.forwarder.addRule('discord', ['telegram'], (msg) => msg.intent === 'lead');
  }

  private async handleMessage(msg: NormalizedMessage): Promise<void> {
    try {
      // RSIS808 observe
      this.observer.observe(msg, msg.intent || 'unknown');

      // Block spam
      if (msg.intent === 'spam') {
        console.warn(`[RSIS808] Blocked spam from ${msg.username}`);
        return;
      }

      // Route
      const { agentId, enriched } = this.router.route(msg);
      const agent = this.agents.get(agentId) || this.agents.get('amanda')!;

      // Run agent
      const response = await agent.process(enriched);

      // Reply back to correct channel
      await this.reply(enriched, response);

      // Forward if rules match
      this.forwarder.forward(enriched);

    } catch (err: any) {
      console.error('[RSIS808] Error:', err.message);
      this.observer.emit('alert', { error: err.message, msg });
    }
  }

  private async reply(msg: NormalizedMessage, text: string): Promise<void> {
    switch (msg.channel) {
      case 'telegram':
        await this.tg?.send(msg.metadata?.chatId as string, text);
        break;
      case 'discord':
        await this.discord?.send(msg.metadata?.channelId as string, text);
        break;
      case 'whatsapp':
        await this.whatsapp?.send(msg.userId, text);
        break;
    }
  }

  async start(): Promise<void> {
    console.log('🔴 VOID-HEADLESS BOOT — XKSH808 KKOS');

    if (this.config.telegram) {
      this.tg = new TelegramBridge(this.config.telegram.token);
      this.tg.on('message', (msg: NormalizedMessage) => this.handleMessage(msg));
      await this.tg.start();
    }

    if (this.config.discord) {
      this.discord = new DiscordBridge(
        this.config.discord.token,
        this.config.discord.watchChannels
      );
      this.discord.on('message', (msg: NormalizedMessage) => this.handleMessage(msg));
      await this.discord.start();
    }

    if (this.config.whatsapp) {
      this.whatsapp = new WhatsAppBridge(this.config.whatsapp);
      this.whatsapp.on('message', (msg: NormalizedMessage) => this.handleMessage(msg));
      await this.whatsapp.start();
    }

    console.log('✅ ALL BRIDGES ONLINE — RSIS808 ACTIVE');
  }

  async stop(): Promise<void> {
    await this.tg?.stop();
    await this.discord?.stop();
    await this.whatsapp?.stop();
    console.log('⏹  VOID-HEADLESS SHUTDOWN');
  }
}
