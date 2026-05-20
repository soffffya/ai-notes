import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { NoteStatus } from '@prisma/client';
import { NotesService } from './notes.service';

describe('NotesService', () => {
  const prisma = {
    category: {
      findFirst: jest.fn(),
    },
    note: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: NotesService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new NotesService(prisma as never);
  });

  it('creates a note in the system category by default', async () => {
    prisma.category.findFirst.mockResolvedValue({
      id: 'category-1',
      isSystem: true,
    });
    prisma.note.create.mockResolvedValue({
      id: 'note-1',
      title: 'Title',
      content: 'Content',
      categoryId: 'category-1',
    });

    const result = await service.create('user-1', {
      title: 'Title',
      content: 'Content',
    });

    expect(prisma.note.create).toHaveBeenCalledWith({
      data: {
        title: 'Title',
        content: 'Content',
        userId: 'user-1',
        categoryId: 'category-1',
      },
      include: {
        category: true,
      },
    });
    expect(result.id).toBe('note-1');
  });

  it('creates a note in the selected category when categoryId is provided', async () => {
    prisma.category.findFirst.mockResolvedValue({
      id: 'category-2',
      userId: 'user-1',
      isSystem: false,
    });
    prisma.note.create.mockResolvedValue({
      id: 'note-2',
      title: 'Title',
      content: 'Content',
      categoryId: 'category-2',
    });

    const result = await service.create('user-1', {
      title: 'Title',
      content: 'Content',
      categoryId: 'category-2',
    });

    expect(prisma.category.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'category-2',
        userId: 'user-1',
      },
    });
    expect(prisma.note.create).toHaveBeenCalledWith({
      data: {
        title: 'Title',
        content: 'Content',
        userId: 'user-1',
        categoryId: 'category-2',
      },
      include: {
        category: true,
      },
    });
    expect(result.categoryId).toBe('category-2');
  });

  it('throws when the system category is missing during note creation', async () => {
    prisma.category.findFirst.mockResolvedValue(null);

    await expect(
      service.create('user-1', {
        title: 'Title',
        content: 'Content',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('throws when creating with a missing category', async () => {
    prisma.category.findFirst.mockResolvedValue(null);

    await expect(
      service.create('user-1', {
        title: 'Title',
        content: 'Content',
        categoryId: 'missing-category',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('finds only active notes sorted by updatedAt desc', async () => {
    prisma.note.findMany.mockResolvedValue([]);

    await service.findAll('user-1');

    expect(prisma.note.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: NoteStatus.ACTIVE },
      include: {
        category: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  });

  it('updates a note and validates the target category', async () => {
    prisma.note.findFirst.mockResolvedValueOnce({
      id: 'note-1',
      userId: 'user-1',
    });
    prisma.category.findFirst.mockResolvedValue({
      id: 'category-2',
      userId: 'user-1',
    });
    prisma.note.update.mockResolvedValue({
      id: 'note-1',
      categoryId: 'category-2',
    });

    const result = await service.update('user-1', 'note-1', {
      content: 'Updated',
      categoryId: 'category-2',
    });

    expect(prisma.category.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'category-2',
        userId: 'user-1',
      },
    });
    expect(prisma.note.update).toHaveBeenCalledWith({
      where: {
        id: 'note-1',
      },
      data: {
        content: 'Updated',
        categoryId: 'category-2',
      },
      include: {
        category: true,
      },
    });
    expect(result.categoryId).toBe('category-2');
  });

  it('throws when updating a missing note', async () => {
    prisma.note.findFirst.mockResolvedValue(null);

    await expect(service.update('user-1', 'missing-note', { content: 'Updated' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws when updating with a missing category', async () => {
    prisma.note.findFirst.mockResolvedValue({
      id: 'note-1',
      userId: 'user-1',
    });
    prisma.category.findFirst.mockResolvedValue(null);

    await expect(
      service.update('user-1', 'note-1', {
        categoryId: 'missing-category',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes an existing note', async () => {
    prisma.note.findFirst.mockResolvedValue({
      id: 'note-1',
      userId: 'user-1',
    });
    prisma.note.delete.mockResolvedValue({ id: 'note-1' });

    await expect(service.remove('user-1', 'note-1')).resolves.toEqual({ success: true });
    expect(prisma.note.delete).toHaveBeenCalledWith({
      where: {
        id: 'note-1',
      },
    });
  });

  it('throws when removing a missing note', async () => {
    prisma.note.findFirst.mockResolvedValue(null);

    await expect(service.remove('user-1', 'missing-note')).rejects.toBeInstanceOf(NotFoundException);
  });
});
