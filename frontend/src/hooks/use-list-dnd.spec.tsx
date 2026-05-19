import { act, renderHook } from '@testing-library/react';
import type { NotesList } from '@/types';
import { useListDnD } from './use-list-dnd';

describe('useListDnD', () => {
  const list: NotesList = {
    id: 'list-1',
    name: 'Work',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      { id: 'item-1', text: 'First', done: false, position: 0 },
      { id: 'item-2', text: 'Second', done: false, position: 1 },
      { id: 'item-3', text: 'Third', done: false, position: 2 },
    ],
  };

  it('calculates reordered ids on drop', async () => {
    const reorderListItems = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useListDnD({
        lists: [list],
        reorderListItems,
      }),
    );

    act(() => {
      result.current.handleListItemDragStart('list-1', 'item-1');
    });

    const dragEvent = {
      preventDefault: vi.fn(),
      clientY: 80,
      currentTarget: {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      },
    } as never;

    act(() => {
      result.current.handleListItemDragOver(dragEvent, 'list-1', 'item-2');
    });

    expect(result.current.dropIndicator).toEqual({
      listId: 'list-1',
      itemId: 'item-2',
      position: 'after',
    });

    await act(async () => {
      await result.current.handleListItemDrop('list-1', 'item-2');
    });

    expect(reorderListItems).toHaveBeenCalledWith('list-1', ['item-2', 'item-1', 'item-3']);
    expect(result.current.dragState).toBeNull();
    expect(result.current.dropIndicator).toBeNull();
  });
});
