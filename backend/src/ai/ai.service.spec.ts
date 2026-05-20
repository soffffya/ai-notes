import { AiActionType } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AiActionExecutor } from './ai-action.executor';
import { AiDecisionEngine } from './ai-decision.engine';
import { AiPayloadHelper } from './ai-payload.helper';
import { AiService } from './ai.service';
import { AiUndoExecutor } from './ai-undo.executor';

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
  let decisionEngine: Pick<AiDecisionEngine, 'getClient' | 'requestDecision'>;
  let actionExecutor: Pick<AiActionExecutor, 'resolveDecision'>;
  let undoExecutor: Pick<AiUndoExecutor, 'undoAction' | 'getUndoExpiresAt'>;

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.OPENAI_API_KEY;

    decisionEngine = {
      getClient: jest.fn(),
      requestDecision: jest.fn(),
    };

    actionExecutor = {
      resolveDecision: jest.fn(),
    };

    undoExecutor = {
      undoAction: jest.fn(),
      getUndoExpiresAt: jest.fn((createdAt: Date) => new Date(createdAt.getTime() + 20_000)),
    };

    service = new AiService(
      prisma as never,
      new AiPayloadHelper(),
      decisionEngine as AiDecisionEngine,
      actionExecutor as AiActionExecutor,
      undoExecutor as AiUndoExecutor,
    );
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

    (decisionEngine.getClient as jest.Mock).mockReturnValue(null);

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

    (decisionEngine.getClient as jest.Mock).mockReturnValue({});
    (decisionEngine.requestDecision as jest.Mock).mockResolvedValue({
      action: 'none',
      confidence: 0.3,
      categoryId: null,
      listId: null,
      itemText: null,
      reason: 'No action',
    });
    (actionExecutor.resolveDecision as jest.Mock).mockResolvedValue({
      status: 'low_confidence',
      confidence: 0.3,
      reason: 'No action',
    });

    const result = await service.analyzeNote('note-1', 'user-1');

    expect(result).toEqual({
      status: 'low_confidence',
      confidence: 0.3,
      reason: 'No action',
    });
    expect(actionExecutor.resolveDecision).toHaveBeenCalledWith(
      'user-1',
      'note-1',
      {
        action: 'none',
        confidence: 0.3,
        categoryId: null,
        listId: null,
        itemText: null,
        reason: 'No action',
      },
      undefined,
    );
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

    (actionExecutor.resolveDecision as jest.Mock).mockResolvedValue({
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
    });

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
    (undoExecutor.getUndoExpiresAt as jest.Mock).mockReturnValue(new Date(Date.now() - 1_000));

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

  it('delegates valid undo requests to the undo executor', async () => {
    prisma.aiActionLog.findFirst.mockResolvedValue({
      id: 'log-1',
      userId: 'user-1',
      type: AiActionType.ADD_TO_LIST,
      autoApplied: true,
      undoneAt: null,
      createdAt: new Date(),
    });
    (undoExecutor.undoAction as jest.Mock).mockResolvedValue({
      status: 'undone',
      actionType: 'add_to_list',
      listId: 'list-1',
      removedListItemId: 'item-1',
      undoneAt: new Date().toISOString(),
    });

    const result = await service.undoAction('log-1', 'user-1');

    expect(undoExecutor.undoAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'log-1', userId: 'user-1' }),
    );
    expect(result).toMatchObject({
      status: 'undone',
      actionType: 'add_to_list',
    });
  });
});
