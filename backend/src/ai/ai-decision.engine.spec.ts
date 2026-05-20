import OpenAI from 'openai';
import { AiDecisionEngine } from './ai-decision.engine';

describe('AiDecisionEngine', () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  it('returns null client when no api key is configured', () => {
    const engine = new AiDecisionEngine();

    expect(engine.getClient()).toBeNull();
  });

  it('prefers a user api key over the server key', () => {
    process.env.OPENAI_API_KEY = 'server-key';
    const engine = new AiDecisionEngine();

    const client = engine.getClient('user-key');

    expect(client).toBeInstanceOf(OpenAI);
    expect((client as OpenAI).apiKey).toBe('user-key');
  });

  it('normalizes an invalid ai json response into a safe none-decision', async () => {
    const engine = new AiDecisionEngine();
    const client = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: '{"action":"wrong","confidence":"oops"}',
                },
              },
            ],
          }),
        },
      },
    } as unknown as OpenAI;

    const result = await engine.requestDecision(client, { title: 'Title', content: 'Body' }, [], []);

    expect(result).toEqual({
      action: 'none',
      confidence: 0,
      categoryId: null,
      listId: null,
      itemText: null,
      reason: 'No reason provided',
    });
  });
});
