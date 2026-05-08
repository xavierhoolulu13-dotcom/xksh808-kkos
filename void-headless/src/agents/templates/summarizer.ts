import OpenAI from 'openai';
import { NormalizedMessage } from '../../types/protocols';

export class SummarizerAgent {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o-mini') {
    this.openai = new OpenAI({ apiKey });
    this.model = model;
  }

  async summarize(messages: NormalizedMessage[]): Promise<string> {
    const transcript = messages
      .map(m => `[${m.channel}] ${m.username}: ${m.content}`)
      .join('\n');

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: 'You are RSIS808, the KKOS intelligence layer. Summarize the following message thread concisely for the operator. Highlight leads, issues, and actions needed.' },
        { role: 'user', content: transcript }
      ],
      max_tokens: 500,
    });

    return completion.choices[0]?.message?.content || '';
  }
}
