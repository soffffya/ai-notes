import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type { AiCategoryOption, AiListOption, AiModelDecision, AiNoteContext } from './ai.types';

@Injectable()
export class AiDecisionEngine {
  private readonly logger = new Logger(AiDecisionEngine.name);
  private readonly model: string;
  private readonly serverApiKey: string | null;

  constructor() {
    this.serverApiKey = process.env.OPENAI_API_KEY ?? null;
    this.model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  }

  getClient(userApiKey?: string) {
    const apiKey = userApiKey?.trim() || this.serverApiKey;
    return apiKey ? new OpenAI({ apiKey }) : null;
  }

  async requestDecision(
    client: OpenAI,
    note: Pick<AiNoteContext, 'title' | 'content'>,
    categories: AiCategoryOption[],
    lists: AiListOption[],
  ): Promise<AiModelDecision> {
    const prompt = [
      'You classify one note for an MVP notes app.',
      'Choose exactly one action: assign_category, add_to_list, or none.',
      'Rules:',
      '- assign_category only when an existing category clearly fits better.',
      '- add_to_list only when the note is clearly an actionable list item that belongs in an existing list.',
      '- never invent categories or lists.',
      '- confidence must be a number from 0 to 1.',
      '- itemText must be short and specific when action is add_to_list.',
      '- if action is none, set categoryId and listId to null.',
      '- respond with valid JSON only.',
      '',
      `Current note title: ${note.title ?? ''}`,
      `Current note content: ${note.content}`,
      '',
      `Available categories: ${JSON.stringify(categories)}`,
      `Available lists: ${JSON.stringify(
        lists.map((list) => ({
          id: list.id,
          name: list.name,
          existingItems: list.items.map((item) => item.text),
        })),
      )}`,
      '',
      'Return JSON with keys:',
      '{"action":"assign_category|add_to_list|none","confidence":0.0,"categoryId":string|null,"listId":string|null,"itemText":string|null,"reason":string}'
    ].join('\n');

    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You are a precise classifier for a notes app. Follow the JSON contract exactly and do not add markdown.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        action: 'none',
        confidence: 0,
        categoryId: null,
        listId: null,
        itemText: null,
        reason: 'Empty AI response',
      };
    }

    try {
      const parsed = JSON.parse(content) as Partial<AiModelDecision>;
      return {
        action:
          parsed.action === 'assign_category' || parsed.action === 'add_to_list'
            ? parsed.action
            : 'none',
        confidence:
          typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0,
        categoryId: typeof parsed.categoryId === 'string' ? parsed.categoryId : null,
        listId: typeof parsed.listId === 'string' ? parsed.listId : null,
        itemText: typeof parsed.itemText === 'string' ? parsed.itemText.trim() : null,
        reason: typeof parsed.reason === 'string' ? parsed.reason : 'No reason provided',
      };
    } catch (error) {
      this.logger.error('Failed to parse AI classification response', error as Error);
      return {
        action: 'none',
        confidence: 0,
        categoryId: null,
        listId: null,
        itemText: null,
        reason: 'Invalid AI JSON response',
      };
    }
  }
}
