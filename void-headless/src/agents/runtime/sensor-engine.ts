import { NormalizedMessage, MessageIntent } from '../../types/protocols';

// RSIS808 Intent Classifier — 808 Beast Mode
const INTENT_MAP: Record<MessageIntent, string[]> = {
  lead: ['website', 'site', 'seo', 'google', 'business', 'help', 'need', 'want', 'price', 'cost', 'how much', 'build', 'design', 'marketing'],
  support: ['broken', 'not working', 'issue', 'problem', 'fix', 'error', 'down', 'help', 'stuck'],
  command: ['/start', '/status', '/run', '/stop', '/deploy', '/report', '/ping', '!'],
  spam: ['click here', 'free money', 'winner', 'congratulations', 'lottery', 'prize', 'bitcoin'],
  general: [],
  unknown: [],
};

export class SensorEngine {
  classifyIntent(msg: NormalizedMessage): MessageIntent {
    const text = msg.content.toLowerCase();

    // Spam first — zero tolerance
    if (INTENT_MAP.spam.some(kw => text.includes(kw))) return 'spam';

    // Command check
    if (INTENT_MAP.command.some(kw => text.startsWith(kw))) return 'command';

    // Lead scoring
    const leadScore = INTENT_MAP.lead.filter(kw => text.includes(kw)).length;
    if (leadScore >= 1) return 'lead';

    // Support
    if (INTENT_MAP.support.some(kw => text.includes(kw))) return 'support';

    return 'general';
  }

  scoreUrgency(msg: NormalizedMessage): number {
    const text = msg.content.toLowerCase();
    let score = 1;
    if (['asap', 'urgent', 'now', 'today', 'immediately'].some(w => text.includes(w))) score = 5;
    else if (['soon', 'this week', 'need'].some(w => text.includes(w))) score = 3;
    return score;
  }

  enrich(msg: NormalizedMessage): NormalizedMessage {
    return {
      ...msg,
      intent: this.classifyIntent(msg),
      metadata: {
        ...msg.metadata,
        urgency: this.scoreUrgency(msg),
        enrichedAt: Date.now(),
      }
    };
  }
}
