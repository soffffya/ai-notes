import { Injectable } from '@nestjs/common';
import { AiActionLog, AiActionType, NoteStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiPayloadHelper } from './ai-payload.helper';
import type { AiAnalyzeResult, AiModelDecision, ResolveDecisionOptions } from './ai.types';

@Injectable()
export class AiActionExecutor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payloadHelper: AiPayloadHelper,
  ) {}

  resolveDecision(
    userId: string,
    noteId: string,
    decision: AiModelDecision,
    options?: ResolveDecisionOptions,
  ): Promise<AiAnalyzeResult> {
    const autoThreshold = Number(process.env.AI_AUTO_APPLY_THRESHOLD ?? '0.85');
    const suggestThreshold = Number(process.env.AI_SUGGEST_THRESHOLD ?? '0.55');

    if (decision.action === 'none' || decision.confidence < suggestThreshold) {
      return Promise.resolve({
        status: 'low_confidence',
        confidence: decision.confidence,
        reason: decision.reason,
      });
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

    return Promise.resolve({
      status: 'low_confidence',
      confidence: decision.confidence,
      reason: 'AI response was incomplete for execution',
    });
  }

  getUndoExpiresAt(createdAt: Date) {
    return new Date(createdAt.getTime() + this.getUndoWindowSeconds() * 1000);
  }

  private getUndoWindowSeconds() {
    return Number(process.env.AI_UNDO_WINDOW_SECONDS ?? '20');
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
      (item) => item.noteId === note.id || item.text.toLowerCase() === normalizedText.toLowerCase(),
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
}
