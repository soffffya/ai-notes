import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { NoteStatus } from '@prisma/client';
import { ListsService } from './lists.service';

describe('ListsService', () => {
  const prisma = {
    list: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    listItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    note: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: ListsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ListsService(prisma as never);
  });

  it('restores archived notes when deleting a list that contains AI-derived items', async () => {
    const restoredNotes = [
      {
        id: 'note-1',
        title: 'Task',
        content: 'buy milk',
        status: NoteStatus.ACTIVE,
        categoryId: 'category-1',
        category: {
          id: 'category-1',
          name: 'Без категории',
          isSystem: true,
        },
      },
    ];

    prisma.list.findFirst.mockResolvedValue({ id: 'list-1', userId: 'user-1' });
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback({
        listItem: {
          findMany: jest.fn().mockResolvedValue([{ noteId: 'note-1' }]),
        },
        list: {
          delete: jest.fn().mockResolvedValue(undefined),
        },
        note: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findMany: jest.fn().mockResolvedValue(restoredNotes),
        },
      } as never),
    );

    const result = await service.remove('user-1', 'list-1');

    expect(result).toEqual({
      success: true,
      restoredNotes,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('creates a list with trimmed name', async () => {
    prisma.list.findFirst.mockResolvedValue(null);
    prisma.list.create.mockResolvedValue({
      id: 'list-1',
      name: 'Покупки',
      items: [],
    });

    const result = await service.create('user-1', { name: '  Покупки  ' });

    expect(prisma.list.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        name: 'Покупки',
      },
      include: {
        items: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });
    expect(result.name).toBe('Покупки');
  });

  it('rejects empty list names', async () => {
    await expect(service.create('user-1', { name: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate list names', async () => {
    prisma.list.findFirst.mockResolvedValue({ id: 'list-1' });

    await expect(service.create('user-1', { name: 'Покупки' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('adds a regular list item with next position', async () => {
    prisma.list.findFirst.mockResolvedValue({
      id: 'list-1',
      userId: 'user-1',
      items: [{ id: 'item-1', text: 'milk', position: 0 }],
    });
    prisma.listItem.create.mockResolvedValue({
      id: 'item-2',
      text: 'bread',
      position: 1,
      noteId: null,
    });

    const result = await service.addItem('user-1', 'list-1', { text: 'bread' });

    expect(prisma.listItem.create).toHaveBeenCalledWith({
      data: {
        listId: 'list-1',
        text: 'bread',
        noteId: undefined,
        position: 1,
      },
    });
    expect(result.position).toBe(1);
  });

  it('rejects duplicate list item text', async () => {
    prisma.list.findFirst.mockResolvedValue({
      id: 'list-1',
      userId: 'user-1',
      items: [{ id: 'item-1', text: 'Milk', position: 0 }],
    });

    await expect(service.addItem('user-1', 'list-1', { text: 'milk' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws when adding an item linked to a missing note', async () => {
    prisma.list.findFirst.mockResolvedValue({
      id: 'list-1',
      userId: 'user-1',
      items: [],
    });
    prisma.note.findFirst.mockResolvedValue(null);

    await expect(
      service.addItem('user-1', 'list-1', { text: 'bread', noteId: 'missing-note' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects invalid reorder payloads', async () => {
    prisma.list.findFirst.mockResolvedValue({ id: 'list-1', userId: 'user-1' });
    prisma.listItem.findMany.mockResolvedValue([
      { id: 'item-1', position: 0 },
      { id: 'item-2', position: 1 },
    ]);

    await expect(
      service.reorderItems('user-1', 'list-1', { itemIds: ['item-1'] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('restores an archived note when deleting an AI-derived list item', async () => {
    prisma.list.findFirst.mockResolvedValue({ id: 'list-1', userId: 'user-1' });
    prisma.listItem.findFirst.mockResolvedValue({
      id: 'item-1',
      listId: 'list-1',
      noteId: 'note-1',
      position: 0,
    });
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback({
        listItem: {
          delete: jest.fn().mockResolvedValue(undefined),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        note: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'note-1',
            userId: 'user-1',
            status: NoteStatus.ARCHIVED,
          }),
          update: jest.fn().mockResolvedValue({
            id: 'note-1',
            title: null,
            content: 'buy milk',
            status: NoteStatus.ACTIVE,
            categoryId: 'category-1',
            category: {
              id: 'category-1',
              name: 'Без категории',
              isSystem: true,
            },
          }),
        },
      } as never),
    );

    const result = await service.removeItem('user-1', 'list-1', 'item-1');

    expect(result.success).toBe(true);
    expect(result.restoredNote).toMatchObject({
      id: 'note-1',
      status: NoteStatus.ACTIVE,
    });
  });

  it('does not restore a note for regular list items without noteId', async () => {
    prisma.list.findFirst.mockResolvedValue({ id: 'list-1', userId: 'user-1' });
    prisma.listItem.findFirst.mockResolvedValue({
      id: 'item-1',
      listId: 'list-1',
      noteId: null,
      position: 1,
    });
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback({
        listItem: {
          delete: jest.fn().mockResolvedValue(undefined),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        note: {
          findFirst: jest.fn(),
          update: jest.fn(),
        },
      } as never),
    );

    const result = await service.removeItem('user-1', 'list-1', 'item-1');

    expect(result).toEqual({
      success: true,
      restoredNote: null,
    });
  });
});
