import { AiActionType } from '@prisma/client';
import { AiPayloadHelper } from './ai-payload.helper';

describe('AiPayloadHelper', () => {
  const helper = new AiPayloadHelper();

  it('converts suggestion category logs back to a model decision', () => {
    const decision = helper.toDecision({
      type: AiActionType.SUGGEST_CATEGORY,
      confidence: 0.62,
      payloadJson: {
        categoryId: 'category-1',
        reason: 'Looks like work',
      },
    } as never);

    expect(decision).toEqual({
      action: 'assign_category',
      confidence: 0.62,
      categoryId: 'category-1',
      listId: null,
      itemText: null,
      reason: 'Looks like work',
    });
  });

  it('extracts list undo payload safely from unknown json', () => {
    expect(helper.getListUndoPayload(null)).toEqual({
      listId: null,
      listItemId: null,
    });

    expect(
      helper.getListUndoPayload({
        listId: 'list-1',
        listItemId: 'item-1',
      }),
    ).toEqual({
      listId: 'list-1',
      listItemId: 'item-1',
    });
  });
});
