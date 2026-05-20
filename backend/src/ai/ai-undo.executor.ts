import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AiActionLog, AiActionType, NoteStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiPayloadHelper } from './ai-payload.helper';
import type { AiUndoResult } from './ai.types';

@Injectable()
export class AiUndoExecutor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payloadHelper: AiPayloadHelper,
  ) {}

  async undoAction(actionLog: AiActionLog): Promise<AiUndoResult> {
    if (actionLog.type === AiActionType.ASSIGN_CATEGORY) {
      return this.undoCategoryAssignment(actionLog);
    }

    if (actionLog.type === AiActionType.ADD_TO_LIST) {
      return this.undoListAddition(actionLog);
    }

    throw new BadRequestException('This AI action type cannot be undone');
  }

  getUndoExpiresAt(createdAt: Date) {
    return new Date(createdAt.getTime() + this.getUndoWindowSeconds() * 1000);
  }

  private getUndoWindowSeconds() {
    return Number(process.env.AI_UNDO_WINDOW_SECONDS ?? '20');
  }

  private async undoCategoryAssignment(actionLog: AiActionLog): Promise<AiUndoResult> {
    const previousCategoryId = this.payloadHelper.getPreviousCategoryId(actionLog.payloadJson);

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
    const { listId, listItemId } = this.payloadHelper.getListUndoPayload(actionLog.payloadJson);

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
