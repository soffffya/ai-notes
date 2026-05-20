import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { AiActionExecutor } from './ai-action.executor';
import { AiDecisionEngine } from './ai-decision.engine';
import { AiPayloadHelper } from './ai-payload.helper';
import { AiUndoExecutor } from './ai-undo.executor';
import type {
  AiAnalyzeResult,
  AiCategoryOption,
  AiListOption,
  AiModelDecision,
  AiNoteContext,
  AiUndoResult,
  ResolveDecisionOptions,
} from './ai.types';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payloadHelper: AiPayloadHelper,
    private readonly decisionEngine: AiDecisionEngine,
    private readonly actionExecutor: AiActionExecutor,
    private readonly undoExecutor: AiUndoExecutor,
  ) {}

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

    const decision = this.payloadHelper.toDecision(actionLog);
    const result = await this.resolveDecision(userId, actionLog.noteId ?? '', decision, {
      sourceActionLog: actionLog,
      forceApply: true,
    });

    await this.prisma.aiActionLog.update({
      where: { id: actionLog.id },
      data: {
        payloadJson: this.payloadHelper.appendAppliedAt(actionLog.payloadJson),
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

    return this.undoExecutor.undoAction(actionLog);
  }

  private getClient(userApiKey?: string) {
    return this.decisionEngine.getClient(userApiKey);
  }

  private requestDecision(
    client: OpenAI,
    note: Pick<AiNoteContext, 'title' | 'content'>,
    categories: AiCategoryOption[],
    lists: AiListOption[],
  ) {
    return this.decisionEngine.requestDecision(client, note, categories, lists);
  }

  private resolveDecision(
    userId: string,
    noteId: string,
    decision: AiModelDecision,
    options?: ResolveDecisionOptions,
  ) {
    return this.actionExecutor.resolveDecision(userId, noteId, decision, options);
  }

  private getUndoExpiresAt(createdAt: Date) {
    return this.undoExecutor.getUndoExpiresAt(createdAt);
  }
}
