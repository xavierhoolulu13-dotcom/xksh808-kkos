import { Client, GatewayIntentBits, Message } from 'discord.js';
import { NormalizedMessage, ChannelType } from '../types/protocols';
import { EventEmitter } from 'events';

export class DiscordBridge extends EventEmitter {
  private client: Client;
  private token: string;
  private watchChannels: string[];

  constructor(token: string, watchChannels: string[] = []) {
    super();
    this.token = token;
    this.watchChannels = watchChannels;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ]
    });
    this.setupHandlers();
  }

  private setupHandlers() {
    this.client.on('ready', () => {
      console.log(`[Discord Bridge] Online as ${this.client.user?.tag}`);
    });

    this.client.on('messageCreate', (msg: Message) => {
      if (msg.author.bot) return;
      if (this.watchChannels.length > 0 && !this.watchChannels.includes(msg.channelId)) return;

      const normalized: NormalizedMessage = {
        id: `dc-${msg.id}`,
        channel: 'discord' as ChannelType,
        userId: msg.author.id,
        username: msg.author.username,
        content: msg.content,
        timestamp: Date.now(),
        raw: msg,
        metadata: {
          guildId: msg.guildId,
          channelId: msg.channelId,
        }
      };

      this.emit('message', normalized);
    });

    this.client.on('error', (err) => {
      this.emit('error', err);
    });
  }

  async send(channelId: string, text: string): Promise<void> {
    const channel = await this.client.channels.fetch(channelId) as any;
    if (channel?.isTextBased()) {
      await channel.send(text);
    }
  }

  async start(): Promise<void> {
    await this.client.login(this.token);
  }

  async stop(): Promise<void> {
    this.client.destroy();
    console.log('[Discord Bridge] Stopped');
  }
}
