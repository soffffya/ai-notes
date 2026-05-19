import { AiController } from './ai.controller';

describe('AiController', () => {
  const aiService = {
    analyzeNote: jest.fn(),
    applySuggestion: jest.fn(),
    undoAction: jest.fn(),
  };

  let controller: AiController;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new AiController(aiService as never);
  });

  it('passes noteId, userId, and user API key to analyzeNote', async () => {
    aiService.analyzeNote.mockResolvedValue({ status: 'skipped', reason: 'missing-openai-key' });

    await expect(
      controller.analyze(
        {
          user: { userId: 'user-1' },
          headers: {
            'x-openai-api-key': 'sk-user',
          },
        } as never,
        'note-1',
      ),
    ).resolves.toEqual({ status: 'skipped', reason: 'missing-openai-key' });
    expect(aiService.analyzeNote).toHaveBeenCalledWith('note-1', 'user-1', 'sk-user');
  });

  it('uses the first API key when the header is an array', async () => {
    aiService.analyzeNote.mockResolvedValue({ status: 'skipped', reason: 'missing-openai-key' });

    await controller.analyze(
      {
        user: { userId: 'user-1' },
        headers: {
          'x-openai-api-key': ['sk-first', 'sk-second'],
        },
      } as never,
      'note-1',
    );

    expect(aiService.analyzeNote).toHaveBeenCalledWith('note-1', 'user-1', 'sk-first');
  });

  it('delegates applySuggestion to AiService', async () => {
    aiService.applySuggestion.mockResolvedValue({ status: 'suggested' });

    await expect(
      controller.applySuggestion({ user: { userId: 'user-1' } } as never, 'log-1'),
    ).resolves.toEqual({ status: 'suggested' });
    expect(aiService.applySuggestion).toHaveBeenCalledWith('log-1', 'user-1');
  });

  it('delegates undo to AiService', async () => {
    aiService.undoAction.mockResolvedValue({ status: 'undone' });

    await expect(controller.undo({ user: { userId: 'user-1' } } as never, 'log-1')).resolves.toEqual({
      status: 'undone',
    });
    expect(aiService.undoAction).toHaveBeenCalledWith('log-1', 'user-1');
  });
});
