import { AiActionType } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AiService } from './ai.service';

describe('AiService', () => {
  const prisma = {
    note: {
      findFirst: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
    },
    list: {
      findMany: jest.fn(),
    },
    aiActionLog: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: AiService;

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.OPENAI_API_KEY;
    service = new AiService(prisma as never);
  });

  it('returns missing-note when analyzeNote cannot find the note', async () => {
    prisma.note.findFirst.mockResolvedValue(null);

    const result = await service.analyzeNote('missing-note', 'user-1');

    expect(result).toEqual({ status: 'missing-note' });
  });

  it('returns skipped when no OpenAI key is available', async () => {
    prisma.note.findFirst.mockResolvedValue({
      id: 'note-1',
      userId: 'user-1',
      title: 'Title',
      content: 'Content',
      category: {
        id: 'category-1',
        name: 'Без категории',
        isSystem: true,
      },
    });

    const result = await service.analyzeNote('note-1', 'user-1');

    expect(result).toEqual({
      status: 'skipped',
      reason: 'missing-openai-key',
    });
  });

  it('returns low_confidence when AI decides none', async () => {
    prisma.note.findFirst.mockResolvedValue({
      id: 'note-1',
      userId: 'user-1',
      title: 'Title',
      content: 'Content',
      category: {
        id: 'category-1',
        name: 'Без категории',
        isSystem: true,
      },
    });
    prisma.category.findMany.mockResolvedValue([]);
    prisma.list.findMany.mockResolvedValue([]);

    jest.spyOn(service as never, 'getClient' as never).mockReturnValue({} as never);
    jest.spyOn(service as never, 'requestDecision' as never).mockResolvedValue({
      action: 'none',
      confidence: 0.3,
      categoryId: null,
      listId: null,
      itemText: null,
      reason: 'No action',
    } as never);

    const result = await service.analyzeNote('note-1', 'user-1');

    expect(result).toEqual({
      status: 'low_confidence',
      confidence: 0.3,
      reason: 'No action',
    });
  });

  it('throws when applySuggestion cannot find the action log', async () => {
    prisma.aiActionLog.findFirst.mockResolvedValue(null);

    await expect(service.applySuggestion('missing-log', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('applies a category suggestion and marks the log payload as applied', async () => {
    prisma.aiActionLog.findFirst.mockResolvedValue({
      id: 'log-1',
      userId: 'user-1',
      noteId: 'note-1',
      type: AiActionType.SUGGEST_CATEGORY,
      confidence: 0.7,
      payloadJson: {
        categoryId: 'category-2',
        reason: 'Looks like work',
      },
    });
    prisma.aiActionLog.update.mockResolvedValue(undefined);

    jest.spyOn(service as never, 'resolveDecision' as never).mockResolvedValue({
      status: 'auto_applied',
      actionLogId: '',
      undoExpiresAt: new Date().toISOString(),
      actionType: 'assign_category',
      confidence: 0.7,
      reason: 'Looks like work',
      note: {
        id: 'note-1',
      },
      categoryName: 'Work',
    } as never);

    const result = await service.applySuggestion('log-1', 'user-1');

    expect(prisma.aiActionLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: {
        payloadJson: expect.objectContaining({
          categoryId: 'category-2',
          reason: 'Looks like work',
          appliedAt: expect.any(String),
        }),
      },
    });
    expect(result).toMatchObject({
      status: 'auto_applied',
      actionType: 'assign_category',
    });
  });

  it('returns expired when undo window has passed', async () => {
    prisma.aiActionLog.findFirst.mockResolvedValue({
      id: 'log-1',
      userId: 'user-1',
      type: AiActionType.ADD_TO_LIST,
      autoApplied: true,
      undoneAt: null,
      createdAt: new Date(Date.now() - 60_000),
    });

    const result = await service.undoAction('log-1', 'user-1');

    expect(result).toEqual({
      status: 'expired',
      reason: 'Undo window has expired',
    });
  });

  it('rejects undo for non-auto-applied actions', async () => {
    prisma.aiActionLog.findFirst.mockResolvedValue({
      id: 'log-1',
      userId: 'user-1',
      type: AiActionType.SUGGEST_LIST,
      autoApplied: false,
      undoneAt: null,
      createdAt: new Date(),
    });

    await expect(service.undoAction('log-1', 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects undo for actions that were already undone', async () => {
    prisma.aiActionLog.findFirst.mockResolvedValue({
      id: 'log-1',
      userId: 'user-1',
      type: AiActionType.ADD_TO_LIST,
      autoApplied: true,
      undoneAt: new Date(),
      createdAt: new Date(),
    });

    await expect(service.undoAction('log-1', 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
