import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AiActionLog, AiActionType, NoteStatus, Prisma } from '@prisma/client';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

type AiModelDecision = {
  action: 'assign_category' | 'add_to_list' | 'none';
  confidence: number;
  categoryId: string | null;
  listId: string | null;
  itemText: string | null;
  reason: string;
};

type AiAnalyzeResult =
  | { status: 'missing-note' }
  | { status: 'skipped'; reason: string }
  | { status: 'low_confidence'; confidence: number; reason: string }
  | {
      status: 'auto_applied';
      actionLogId: string;
      undoExpiresAt: string;
      actionType: 'assign_category' | 'add_to_list';
      confidence: number;
      reason: string;
      note: unknown;
      categoryName?: string;
      listId?: string;
      listName?: string;
      listItem?: unknown;
    }
  | {
      status: 'suggested';
      actionLogId: string;
      actionType: 'assign_category' | 'add_to_list';
      confidence: number;
      reason: string;
      categoryId?: string;
      categoryName?: string;
      listId?: string;
      listName?: string;
      itemText?: string;
    };

type AiUndoResult =
  | {
      status: 'undone';
      actionType: 'assign_category' | 'add_to_list';
      note?: unknown;
      listId?: string;
      removedListItemId?: string;
      undoneAt: string;
    }
  | {
      status: 'expired';
      reason: string;
    };

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly model: string;
  private readonly serverApiKey: string | null;

  constructor(private readonly prisma: PrismaService) {
    this.serverApiKey = process.env.OPENAI_API_KEY ?? null;
    this.model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  }

  async analyzeNote(noteId: string, userId: string, userApiKey?: string): Promise<AiAnalyzeResult> {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, userId },
      include: {
        category: true,
      },
    });

    if (!note) {
      return { status: 'missing-note' };
    }

    const client = this.getClient(userApiKey);

    if (!client) {
      this.logger.warn('OPENAI_API_KEY is not configured');
      return { status: 'skipped', reason: 'missing-openai-key' };
    }

    const [categories, lists] = await Promise.all([
      this.prisma.category.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          isSystem: true,
        },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.list.findMany({
        where: { userId },
        include: {
          items: {
            select: {
              id: true,
              text: true,
              noteId: true,
            },
            orderBy: {
              position: 'asc',
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      }),
    ]);

    const decision = await this.requestDecision(client, note, categories, lists);
    return this.resolveDecision(userId, note.id, decision);
  }

  async applySuggestion(actionLogId: string, userId: string): Promise<AiAnalyzeResult> {
    const actionLog = await this.prisma.aiActionLog.findFirst({
      where: {
        id: actionLogId,
        userId,
      },
    });

    if (!actionLog) {
      throw new NotFoundException('AI suggestion not found');
    }

    const payload = actionLog.payloadJson as Prisma.JsonObject;
    const decision: AiModelDecision = {
      action:
        actionLog.type === AiActionType.SUGGEST_CATEGORY
          ? 'assign_category'
          : actionLog.type === AiActionType.SUGGEST_LIST
            ? 'add_to_list'
            : 'none',
      confidence: actionLog.confidence,
      categoryId: (payload.categoryId as string | null | undefined) ?? null,
      listId: (payload.listId as string | null | undefined) ?? null,
      itemText: (payload.itemText as string | null | undefined) ?? null,
      reason: (payload.reason as string | undefined) ?? 'Suggestion applied manually',
    };

    const result = await this.resolveDecision(userId, actionLog.noteId ?? '', decision, {
      sourceActionLog: actionLog,
      forceApply: true,
    });

    await this.prisma.aiActionLog.update({
      where: { id: actionLog.id },
      data: {
        payloadJson: {
          ...(payload ?? {}),
          appliedAt: new Date().toISOString(),
        },
      },
    });

    return result;
  }

  async undoAction(actionLogId: string, userId: string): Promise<AiUndoResult> {
    const actionLog = await this.prisma.aiActionLog.findFirst({
      where: {
        id: actionLogId,
        userId,
      },
    });

    if (!actionLog) {
      throw new NotFoundException('AI action not found');
    }

    if (!actionLog.autoApplied) {
      throw new BadRequestException('Only auto-applied AI actions can be undone');
    }

    if (actionLog.undoneAt) {
      throw new BadRequestException('AI action has already been undone');
    }

    const expiresAt = this.getUndoExpiresAt(actionLog.createdAt);
    if (Date.now() > expiresAt.getTime()) {
      return {
        status: 'expired',
        reason: 'Undo window has expired',
      };
    }

    if (actionLog.type === AiActionType.ASSIGN_CATEGORY) {
      return this.undoCategoryAssignment(actionLog);
    }

    if (actionLog.type === AiActionType.ADD_TO_LIST) {
      return this.undoListAddition(actionLog);
    }

    throw new BadRequestException('This AI action type cannot be undone');
  }

  private getClient(userApiKey?: string) {
    const apiKey = userApiKey?.trim() || this.serverApiKey;
    return apiKey ? new OpenAI({ apiKey }) : null;
  }

  private async requestDecision(
    client: OpenAI,
    note: { title: string | null; content: string },
    categories: Array<{ id: string; name: string; isSystem: boolean }>,
    lists: Array<{
      id: string;
      name: string;
      items: Array<{ id: string; text: string; noteId: string | null }>;
    }>,
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
      '{"action":"assign_category|add_to_list|none","confidence":0.0,"categoryId":string|null,"listId":string|null,"itemText":string|null,"reason":string}',
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

  private async resolveDecision(
    userId: string,
    noteId: string,
    decision: AiModelDecision,
    options?: {
      sourceActionLog?: AiActionLog;
      forceApply?: boolean;
    },
  ): Promise<AiAnalyzeResult> {
    const autoThreshold = Number(process.env.AI_AUTO_APPLY_THRESHOLD ?? '0.85');
    const suggestThreshold = Number(process.env.AI_SUGGEST_THRESHOLD ?? '0.55');

    if (decision.action === 'none' || decision.confidence < suggestThreshold) {
      return {
        status: 'low_confidence',
        confidence: decision.confidence,
        reason: decision.reason,
      };
    }

    const shouldApply = options?.forceApply || decision.confidence >= autoThreshold;

    if (!shouldApply) {
      return this.createSuggestionLog(userId, noteId, decision);
    }

    if (decision.action === 'assign_category' && decision.categoryId) {
      return this.applyCategoryDecision(userId, noteId, decision, options?.sourceActionLog);
    }

    if (decision.action === 'add_to_list' && decision.listId && decision.itemText) {
      return this.applyListDecision(userId, noteId, decision, options?.sourceActionLog);
    }

    return {
      status: 'low_confidence',
      confidence: decision.confidence,
      reason: 'AI response was incomplete for execution',
    };
  }

  private async createSuggestionLog(
    userId: string,
    noteId: string,
    decision: AiModelDecision,
  ): Promise<AiAnalyzeResult> {
    if (decision.action === 'assign_category' && decision.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: decision.categoryId,
          userId,
        },
      });

      if (!category) {
        return {
          status: 'low_confidence',
          confidence: decision.confidence,
          reason: 'Suggested category was not found',
        };
      }

      const log = await this.prisma.aiActionLog.create({
        data: {
          userId,
          noteId,
          type: AiActionType.SUGGEST_CATEGORY,
          confidence: decision.confidence,
          payloadJson: {
            categoryId: category.id,
            reason: decision.reason,
          },
        },
      });

      return {
        status: 'suggested',
        actionLogId: log.id,
        actionType: 'assign_category',
        confidence: decision.confidence,
        reason: decision.reason,
        categoryId: category.id,
        categoryName: category.name,
      };
    }

    if (decision.action === 'add_to_list' && decision.listId && decision.itemText) {
      const list = await this.prisma.list.findFirst({
        where: {
          id: decision.listId,
          userId,
        },
      });

      if (!list) {
        return {
          status: 'low_confidence',
          confidence: decision.confidence,
          reason: 'Suggested list was not found',
        };
      }

      const log = await this.prisma.aiActionLog.create({
        data: {
          userId,
          noteId,
          type: AiActionType.SUGGEST_LIST,
          confidence: decision.confidence,
          payloadJson: {
            listId: list.id,
            itemText: decision.itemText,
            reason: decision.reason,
          },
        },
      });

      return {
        status: 'suggested',
        actionLogId: log.id,
        actionType: 'add_to_list',
        confidence: decision.confidence,
        reason: decision.reason,
        listId: list.id,
        listName: list.name,
        itemText: decision.itemText,
      };
    }

    return {
      status: 'low_confidence',
      confidence: decision.confidence,
      reason: decision.reason,
    };
  }

  private async applyCategoryDecision(
    userId: string,
    noteId: string,
    decision: AiModelDecision,
    sourceActionLog?: AiActionLog,
  ): Promise<AiAnalyzeResult> {
    const [note, category] = await Promise.all([
      this.prisma.note.findFirst({
        where: {
          id: noteId,
          userId,
        },
        include: {
          category: true,
        },
      }),
      this.prisma.category.findFirst({
        where: {
          id: decision.categoryId!,
          userId,
        },
      }),
    ]);

    if (!note || !category) {
      return {
        status: 'low_confidence',
        confidence: decision.confidence,
        reason: 'Category application target was not found',
      };
    }

    if (note.categoryId === category.id) {
      return {
        status: 'low_confidence',
        confidence: decision.confidence,
        reason: 'Note is already in that category',
      };
    }

    const updatedNote = await this.prisma.note.update({
      where: { id: note.id },
      data: {
        categoryId: category.id,
      },
      include: {
        category: true,
      },
    });

    let actionLog: AiActionLog | null = null;
    if (!sourceActionLog) {
      actionLog = await this.prisma.aiActionLog.create({
        data: {
          userId,
          noteId: note.id,
          type: AiActionType.ASSIGN_CATEGORY,
          confidence: decision.confidence,
          autoApplied: true,
          payloadJson: {
            previousCategoryId: note.categoryId,
            nextCategoryId: category.id,
            reason: decision.reason,
          },
        },
      });
    }

    return {
      status: 'auto_applied',
      actionLogId: actionLog?.id ?? '',
      undoExpiresAt: actionLog
        ? this.getUndoExpiresAt(actionLog.createdAt).toISOString()
        : new Date().toISOString(),
      actionType: 'assign_category',
      confidence: decision.confidence,
      reason: decision.reason,
      note: updatedNote,
      categoryName: category.name,
    };
  }

  private async applyListDecision(
    userId: string,
    noteId: string,
    decision: AiModelDecision,
    sourceActionLog?: AiActionLog,
  ): Promise<AiAnalyzeResult> {
    const [note, list] = await Promise.all([
      this.prisma.note.findFirst({
        where: {
          id: noteId,
          userId,
        },
        include: {
          category: true,
        },
      }),
      this.prisma.list.findFirst({
        where: {
          id: decision.listId!,
          userId,
        },
        include: {
          items: true,
        },
      }),
    ]);

    if (!note || !list) {
      return {
        status: 'low_confidence',
        confidence: decision.confidence,
        reason: 'List application target was not found',
      };
    }

    const normalizedText = decision.itemText!.trim();
    if (!normalizedText) {
      return {
        status: 'low_confidence',
        confidence: decision.confidence,
        reason: 'Suggested list item text was empty',
      };
    }

    const duplicate = list.items.find(
      (item) =>
        item.noteId === note.id || item.text.toLowerCase() === normalizedText.toLowerCase(),
    );

    if (duplicate) {
      return {
        status: 'low_confidence',
        confidence: decision.confidence,
        reason: 'That note already exists in the target list',
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const archivedNote = await tx.note.update({
        where: { id: note.id },
        data: {
          status: NoteStatus.ARCHIVED,
        },
        include: {
          category: true,
        },
      });

      const createdListItem = await tx.listItem.create({
        data: {
          listId: list.id,
          noteId: note.id,
          text: normalizedText,
          position: list.items.length,
        },
      });

      let createdActionLog: AiActionLog | null = null;
      if (!sourceActionLog) {
        createdActionLog = await tx.aiActionLog.create({
          data: {
            userId,
            noteId: note.id,
            type: AiActionType.ADD_TO_LIST,
            confidence: decision.confidence,
            autoApplied: true,
            payloadJson: {
              listId: list.id,
              listItemId: createdListItem.id,
              itemText: normalizedText,
              reason: decision.reason,
            },
          },
        });
      }

      return {
        archivedNote,
        createdListItem,
        createdActionLog,
      };
    });

    return {
      status: 'auto_applied',
      actionLogId: result.createdActionLog?.id ?? '',
      undoExpiresAt: result.createdActionLog
        ? this.getUndoExpiresAt(result.createdActionLog.createdAt).toISOString()
        : new Date().toISOString(),
      actionType: 'add_to_list',
      confidence: decision.confidence,
      reason: decision.reason,
      note: result.archivedNote,
      listId: list.id,
      listName: list.name,
      listItem: result.createdListItem,
    };
  }

  private getUndoWindowSeconds() {
    return Number(process.env.AI_UNDO_WINDOW_SECONDS ?? '20');
  }

  private getUndoExpiresAt(createdAt: Date) {
    return new Date(createdAt.getTime() + this.getUndoWindowSeconds() * 1000);
  }

  private async undoCategoryAssignment(actionLog: AiActionLog): Promise<AiUndoResult> {
    const payload = actionLog.payloadJson as Prisma.JsonObject;
    const previousCategoryId = payload.previousCategoryId as string | undefined;

    if (!actionLog.noteId || !previousCategoryId) {
      throw new BadRequestException('AI category action payload is incomplete');
    }

    const note = await this.prisma.note.findFirst({
      where: {
        id: actionLog.noteId,
        userId: actionLog.userId,
      },
    });

    if (!note) {
      throw new NotFoundException('Note for AI action was not found');
    }

    const category = await this.prisma.category.findFirst({
      where: {
        id: previousCategoryId,
        userId: actionLog.userId,
      },
    });

    if (!category) {
      throw new NotFoundException('Previous category for AI action was not found');
    }

    const updatedNote = await this.prisma.note.update({
      where: {
        id: note.id,
      },
      data: {
        categoryId: previousCategoryId,
      },
      include: {
        category: true,
      },
    });

    const undoneAt = new Date();
    await this.prisma.aiActionLog.update({
      where: { id: actionLog.id },
      data: {
        undoneAt,
      },
    });

    return {
      status: 'undone',
      actionType: 'assign_category',
      note: updatedNote,
      undoneAt: undoneAt.toISOString(),
    };
  }

  private async undoListAddition(actionLog: AiActionLog): Promise<AiUndoResult> {
    const payload = actionLog.payloadJson as Prisma.JsonObject;
    const listId = payload.listId as string | undefined;
    const listItemId = payload.listItemId as string | undefined;

    if (!listId || !listItemId || !actionLog.noteId) {
      throw new BadRequestException('AI list action payload is incomplete');
    }

    const [item, note] = await Promise.all([
      this.prisma.listItem.findFirst({
        where: {
          id: listItemId,
          listId,
        },
      }),
      this.prisma.note.findFirst({
        where: {
          id: actionLog.noteId,
          userId: actionLog.userId,
        },
      }),
    ]);

    if (!item) {
      throw new NotFoundException('List item for AI action was not found');
    }

    if (!note) {
      throw new NotFoundException('Note for AI list action was not found');
    }

    const undoneAt = new Date();
    const [, , restoredNote] = await this.prisma.$transaction([
      this.prisma.listItem.delete({
        where: {
          id: item.id,
        },
      }),
      this.prisma.listItem.updateMany({
        where: {
          listId,
          position: {
            gt: item.position,
          },
        },
        data: {
          position: {
            decrement: 1,
          },
        },
      }),
      this.prisma.note.update({
        where: {
          id: note.id,
        },
        data: {
          status: NoteStatus.ACTIVE,
        },
        include: {
          category: true,
        },
      }),
      this.prisma.aiActionLog.update({
        where: { id: actionLog.id },
        data: {
          undoneAt,
        },
      }),
    ]);

    return {
      status: 'undone',
      actionType: 'add_to_list',
      note: restoredNote,
      listId,
      removedListItemId: item.id,
      undoneAt: undoneAt.toISOString(),
    };
  }
}
