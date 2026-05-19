import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { NoteStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListDto } from './dto/create-list.dto';
import { CreateListItemDto } from './dto/create-list-item.dto';
import { ReorderListItemsDto } from './dto/reorder-list-items.dto';
import { UpdateListItemDto } from './dto/update-list-item.dto';

@Injectable()
export class ListsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.list.findMany({
      where: { userId },
      include: {
        items: {
          orderBy: {
            position: 'asc',
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async create(userId: string, dto: CreateListDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('List name is required');
    }

    const existingList = await this.prisma.list.findFirst({
      where: {
        userId,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existingList) {
      throw new ConflictException('List already exists');
    }

    return this.prisma.list.create({
      data: {
        userId,
        name,
      },
      include: {
        items: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });
  }

  async remove(userId: string, listId: string) {
    await this.ensureListOwnership(userId, listId);

    const result = await this.prisma.$transaction(async (tx) => {
      const itemsWithArchivedNotes = await tx.listItem.findMany({
        where: {
          listId,
          note: {
            userId,
            status: NoteStatus.ARCHIVED,
          },
        },
        select: {
          noteId: true,
        },
      });

      const noteIdsToRestore = itemsWithArchivedNotes
        .map((item) => item.noteId)
        .filter((noteId): noteId is string => Boolean(noteId));

      await tx.list.delete({
        where: {
          id: listId,
        },
      });

      if (!noteIdsToRestore.length) {
        return [];
      }

      await tx.note.updateMany({
        where: {
          id: { in: noteIdsToRestore },
          userId,
          status: NoteStatus.ARCHIVED,
        },
        data: {
          status: NoteStatus.ACTIVE,
        },
      });

      return tx.note.findMany({
        where: {
          id: { in: noteIdsToRestore },
          userId,
          status: NoteStatus.ACTIVE,
        },
        include: {
          category: true,
        },
      });
    });

    return { success: true, restoredNotes: result };
  }

  async addItem(userId: string, listId: string, dto: CreateListItemDto) {
    const list = await this.prisma.list.findFirst({
      where: {
        id: listId,
        userId,
      },
      include: {
        items: true,
      },
    });

    if (!list) {
      throw new NotFoundException('List not found');
    }

    const text = dto.text.trim();
    if (!text) {
      throw new BadRequestException('List item text is required');
    }
    if (list.items.some((item) => item.text.toLowerCase() === text.toLowerCase())) {
      throw new ConflictException('List item already exists');
    }

    if (dto.noteId) {
      const note = await this.prisma.note.findFirst({
        where: {
          id: dto.noteId,
          userId,
        },
      });

      if (!note) {
        throw new NotFoundException('Note not found');
      }
    }

    const item = await this.prisma.listItem.create({
      data: {
        listId,
        text,
        noteId: dto.noteId,
        position: list.items.length,
      },
    });

    return item;
  }

  async updateItem(userId: string, listId: string, itemId: string, dto: UpdateListItemDto) {
    await this.ensureListOwnership(userId, listId);

    const item = await this.prisma.listItem.findFirst({
      where: {
        id: itemId,
        listId,
      },
    });

    if (!item) {
      throw new NotFoundException('List item not found');
    }

    if (dto.text) {
      const normalizedText = dto.text.trim();
      if (!normalizedText) {
        throw new BadRequestException('List item text is required');
      }
      const duplicate = await this.prisma.listItem.findFirst({
        where: {
          listId,
          id: {
            not: itemId,
          },
          text: {
            equals: normalizedText,
            mode: 'insensitive',
          },
        },
      });

      if (duplicate) {
        throw new ConflictException('List item already exists');
      }
    }

    return this.prisma.listItem.update({
      where: { id: itemId },
      data: {
        text: dto.text?.trim(),
        done: dto.done,
      },
    });
  }

  async reorderItems(userId: string, listId: string, dto: ReorderListItemsDto) {
    await this.ensureListOwnership(userId, listId);

    const items = await this.prisma.listItem.findMany({
      where: { listId },
      orderBy: { position: 'asc' },
    });

    if (items.length !== dto.itemIds.length) {
      throw new ConflictException('Reorder payload must include all list items');
    }

    const itemIds = new Set(items.map((item) => item.id));
    const hasUnknownIds = dto.itemIds.some((itemId) => !itemIds.has(itemId));
    if (hasUnknownIds) {
      throw new ConflictException('Reorder payload contains unknown item ids');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [index, itemId] of dto.itemIds.entries()) {
        await tx.listItem.update({
          where: { id: itemId },
          data: {
            position: index + dto.itemIds.length,
          },
        });
      }

      for (const [index, itemId] of dto.itemIds.entries()) {
        await tx.listItem.update({
          where: { id: itemId },
          data: {
            position: index,
          },
        });
      }
    });

    return this.prisma.listItem.findMany({
      where: { listId },
      orderBy: { position: 'asc' },
    });
  }

  async removeItem(userId: string, listId: string, itemId: string) {
    await this.ensureListOwnership(userId, listId);

    const item = await this.prisma.listItem.findFirst({
      where: {
        id: itemId,
        listId,
      },
    });

    if (!item) {
      throw new NotFoundException('List item not found');
    }

    const restoredNote = await this.prisma.$transaction(async (tx) => {
      await tx.listItem.delete({
        where: {
          id: itemId,
        },
      });

      await tx.listItem.updateMany({
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
      });

      if (!item.noteId) {
        return null;
      }

      const note = await tx.note.findFirst({
        where: {
          id: item.noteId,
          userId,
          status: NoteStatus.ARCHIVED,
        },
      });

      if (!note) {
        return null;
      }

      return tx.note.update({
        where: {
          id: note.id,
        },
        data: {
          status: NoteStatus.ACTIVE,
        },
        include: {
          category: true,
        },
      });
    });

    return { success: true, restoredNote };
  }

  private async ensureListOwnership(userId: string, listId: string) {
    const list = await this.prisma.list.findFirst({
      where: {
        id: listId,
        userId,
      },
    });

    if (!list) {
      throw new NotFoundException('List not found');
    }

    return list;
  }
}
