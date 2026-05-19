import { useState, type DragEvent } from 'react';
import type { DragState, DropIndicator } from '@/components/home/types';
import type { NotesList } from '@/types';

type UseListDnDArgs = {
  lists: NotesList[];
  reorderListItems: (listId: string, nextItemIds: string[]) => Promise<void>;
};

export function useListDnD({ lists, reorderListItems }: UseListDnDArgs) {
  const [dragState, setDragState] = useState<DragState>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);

  async function moveListItemByDrop(
    listId: string,
    draggedItemId: string,
    targetItemId: string,
    position: 'before' | 'after',
  ) {
    if (draggedItemId === targetItemId) {
      return;
    }

    const list = lists.find((entry) => entry.id === listId);
    if (!list) {
      return;
    }

    const draggedIndex = list.items.findIndex((entry) => entry.id === draggedItemId);
    const targetIndex = list.items.findIndex((entry) => entry.id === targetItemId);
    if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) {
      return;
    }

    const reordered = [...list.items];
    const [draggedItem] = reordered.splice(draggedIndex, 1);
    const adjustedTargetIndex =
      position === 'after'
        ? draggedIndex < targetIndex
          ? targetIndex
          : targetIndex + 1
        : draggedIndex < targetIndex
          ? targetIndex - 1
          : targetIndex;

    reordered.splice(adjustedTargetIndex, 0, draggedItem);
    await reorderListItems(
      listId,
      reordered.map((entry) => entry.id),
    );
  }

  function handleListItemDragStart(listId: string, itemId: string) {
    setDragState({ listId, itemId });
  }

  function handleListItemDragEnd() {
    setDragState(null);
    setDropIndicator(null);
  }

  function handleListItemDragOver(
    event: DragEvent<HTMLDivElement>,
    listId: string,
    targetItemId: string,
  ) {
    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const position = offsetY < rect.height / 2 ? 'before' : 'after';

    setDropIndicator((current) => {
      if (
        current?.listId === listId &&
        current.itemId === targetItemId &&
        current.position === position
      ) {
        return current;
      }

      return { listId, itemId: targetItemId, position };
    });
  }

  async function handleListItemDrop(listId: string, targetItemId: string) {
    const currentDrag = dragState;
    const currentDrop = dropIndicator;
    setDragState(null);
    setDropIndicator(null);

    if (!currentDrag || currentDrag.listId !== listId) {
      return;
    }

    await moveListItemByDrop(
      listId,
      currentDrag.itemId,
      targetItemId,
      currentDrop?.listId === listId && currentDrop.itemId === targetItemId
        ? currentDrop.position
        : 'before',
    );
  }

  return {
    dragState,
    dropIndicator,
    handleListItemDragStart,
    handleListItemDragEnd,
    handleListItemDragOver,
    handleListItemDrop,
  };
}
