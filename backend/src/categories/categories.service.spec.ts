import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  const prisma = {
    category: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    note: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: CategoriesService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new CategoriesService(prisma as never);
  });

  it('returns categories ordered with system first', async () => {
    prisma.category.findMany.mockResolvedValue([]);

    await service.findAll('user-1');

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  });

  it('creates a category with trimmed name', async () => {
    prisma.category.findFirst.mockResolvedValue(null);
    prisma.category.create.mockResolvedValue({
      id: 'category-1',
      name: 'Работа',
    });

    const result = await service.create('user-1', { name: '  Работа  ' });

    expect(prisma.category.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        name: 'Работа',
      },
    });
    expect(result.name).toBe('Работа');
  });

  it('rejects empty category names', async () => {
    await expect(service.create('user-1', { name: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate category names', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'category-1' });

    await expect(service.create('user-1', { name: 'Работа' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('reassigns notes and deletes a regular category', async () => {
    prisma.category.findFirst
      .mockResolvedValueOnce({
        id: 'category-2',
        userId: 'user-1',
        isSystem: false,
      })
      .mockResolvedValueOnce({
        id: 'system-category',
        userId: 'user-1',
        isSystem: true,
      });
    prisma.$transaction.mockResolvedValue([]);

    const result = await service.remove('user-1', 'category-2');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      reassignedToCategoryId: 'system-category',
    });
  });

  it('rejects deletion of the system category', async () => {
    prisma.category.findFirst.mockResolvedValue({
      id: 'system-category',
      userId: 'user-1',
      isSystem: true,
    });

    await expect(service.remove('user-1', 'system-category')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws when deleting a missing category', async () => {
    prisma.category.findFirst.mockResolvedValue(null);

    await expect(service.remove('user-1', 'missing-category')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws when the fallback system category is missing', async () => {
    prisma.category.findFirst
      .mockResolvedValueOnce({
        id: 'category-2',
        userId: 'user-1',
        isSystem: false,
      })
      .mockResolvedValueOnce(null);

    await expect(service.remove('user-1', 'category-2')).rejects.toBeInstanceOf(NotFoundException);
  });
});
