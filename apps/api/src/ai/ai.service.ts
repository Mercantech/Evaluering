import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';

export type AiChatRole = 'system' | 'user' | 'assistant';

export type AiChatMessage = {
  role: AiChatRole;
  content: string;
};

@Injectable()
export class AiService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    const apiKey =
      process.env.OPENAI_API_KEY?.trim() || process.env.AI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OpenAI er ikke konfigureret. Sæt OPENAI_API_KEY eller AI_API_KEY i .env',
      );
    }
    if (!this.client) {
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  async complete(system: string, user: string): Promise<string> {
    return this.chat([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
  }

  async chat(
    messages: AiChatMessage[],
    options?: { json?: boolean },
  ): Promise<string> {
    const client = this.getClient();
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';

    try {
      const completion = await client.chat.completions.create({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        ...(options?.json
          ? { response_format: { type: 'json_object' as const } }
          : {}),
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (!text) {
        throw new ServiceUnavailableException('AI returnerede intet svar');
      }
      return text;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      const message =
        err instanceof Error ? err.message : 'Ukendt AI-fejl';
      throw new ServiceUnavailableException(
        `AI-kald fejlede: ${message}`,
      );
    }
  }
}
