import { VoidHeadlessBootstrap } from './bootstrap/bootstrap';
import * as dotenv from 'dotenv';

dotenv.config();

const config = {
  telegram: process.env.TG_BOT_TOKEN ? {
    token: process.env.TG_BOT_TOKEN
  } : undefined,

  discord: process.env.DISCORD_BOT_TOKEN ? {
    token: process.env.DISCORD_BOT_TOKEN,
    watchChannels: process.env.DISCORD_WATCH_CHANNELS?.split(',') || []
  } : undefined,

  whatsapp: (process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN) ? {
    webhookSecret: process.env.WA_WEBHOOK_SECRET || '',
    phoneNumberId: process.env.WA_PHONE_NUMBER_ID,
    accessToken: process.env.WA_ACCESS_TOKEN
  } : undefined,

  openai: {
    apiKey: process.env.OPENAI_API_KEY || ''
  },

  operatorChatId: process.env.OPERATOR_CHAT_ID
};

const system = new VoidHeadlessBootstrap(config);

system.start().catch((err) => {
  console.error('[FATAL] Boot failed:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => system.stop().then(() => process.exit(0)));
process.on('SIGTERM', () => system.stop().then(() => process.exit(0)));
