import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { NoteStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateNoteDto) {
    let categoryId = dto.categoryId;

    if (categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: categoryId,
          userId,
        },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }
    } else {
      const uncategorized = await this.prisma.category.findFirst({
        where: {
          userId,
          isSystem: true,
        },
      });

      if (!uncategorized) {
        throw new InternalServerErrorException('System category is missing');
      }

      categoryId = uncategorized.id;
    }

    return this.prisma.note.create({
      data: {
        title: dto.title,
        content: dto.content,
        userId,
        categoryId,
      },
      include: {
        category: true,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.note.findMany({
      where: { userId, status: NoteStatus.ACTIVE },
      include: {
        category: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async update(userId: string, noteId: string, dto: UpdateNoteDto) {
    const existingNote = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        userId,
      },
    });

    if (!existingNote) {
      throw new NotFoundException('Note not found');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: dto.categoryId,
          userId,
        },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    return this.prisma.note.update({
      where: {
        id: noteId,
      },
      data: dto,
      include: {
        category: true,
      },
    });
  }

  async remove(userId: string, noteId: string) {
    const existingNote = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        userId,
      },
    });

    if (!existingNote) {
      throw new NotFoundException('Note not found');
    }

    await this.prisma.note.delete({
      where: {
        id: noteId,
      },
    });

    return { success: true };
  }
}
