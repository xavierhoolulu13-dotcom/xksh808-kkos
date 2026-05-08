import { Telegraf, Context } from 'telegraf';
import { NormalizedMessage, ChannelType } from '../types/protocols';
import { EventEmitter } from 'events';

export class TelegramBridge extends EventEmitter {
  private bot: Telegraf;
  private token: string;

  constructor(token: string) {
    super();
    this.token = token;
    this.bot = new Telegraf(token);
    this.setupHandlers();
  }

  private setupHandlers() {
    this.bot.on('message', (ctx: Context) => {
      const msg = ctx.message as any;
      if (!msg?.text) return;

      const normalized: NormalizedMessage = {
        id: `tg-${msg.message_id}`,
        channel: 'telegram' as ChannelType,
        userId: String(msg.from?.id),
        username: msg.from?.username || msg.from?.first_name || 'unknown',
        content: msg.text,
        timestamp: Date.now(),
        raw: msg,
        metadata: {
          chatId: msg.chat?.id,
          chatType: msg.chat?.type,
        }
      };

      this.emit('message', normalized, ctx);
    });

    this.bot.catch((err: unknown) => {
      this.emit('error', err);
    });
  }

  async send(chatId: string | number, text: string): Promise<void> {
    await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
  }

  async start(): Promise<void> {
    await this.bot.launch();
    console.log('[TG Bridge] Online');
  }

  async stop(): Promise<void> {
    this.bot.stop();
    console.log('[TG Bridge] Stopped');
  }
}
