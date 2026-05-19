import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateCategoryDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Category name is required');
    }

    const existingCategory = await this.prisma.category.findFirst({
      where: {
        userId,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existingCategory) {
      throw new ConflictException('Category already exists');
    }

    return this.prisma.category.create({
      data: {
        userId,
        name,
      },
    });
  }

  async remove(userId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        userId,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.isSystem) {
      throw new BadRequestException('System category cannot be deleted');
    }

    const uncategorized = await this.prisma.category.findFirst({
      where: {
        userId,
        isSystem: true,
      },
    });

    if (!uncategorized) {
      throw new NotFoundException('System category is missing');
    }

    await this.prisma.$transaction([
      this.prisma.note.updateMany({
        where: {
          userId,
          categoryId,
        },
        data: {
          categoryId: uncategorized.id,
        },
      }),
      this.prisma.category.delete({
        where: {
          id: categoryId,
        },
      }),
    ]);

    return { success: true, reassignedToCategoryId: uncategorized.id };
  }
}
