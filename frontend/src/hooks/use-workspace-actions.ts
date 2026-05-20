import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createCategory as createCategoryRequest,
  createList as createListRequest,
  createListItem as createListItemRequest,
  deleteCategory as deleteCategoryRequest,
  deleteList as deleteListRequest,
  deleteListItem as deleteListItemRequest,
  deleteNote as deleteNoteRequest,
  reorderListItems as reorderListItemsRequest,
  updateListItem as updateListItemRequest,
} from '@/api/workspace';
import type { WorkspaceState } from '@/hooks/use-workspace-data';
import type { Category, ListItem, Note } from '@/types';

type UndoScheduler = (args: {
  key: string;
  title: string;
  optimistic: () => void;
  rollback: () => void;
  commit: () => Promise<void>;
}) => void;

type UseWorkspaceActionsArgs = {
  clearNoteSuggestion: (noteId: string | null) => void;
  displayCategoryName: (category?: Category | null) => string;
  notifyError: (error: unknown, fallback: string) => void;
  scheduleUndoableAction: UndoScheduler;
  selectedListId: string | null;
  setSelectedListId: (value: string | null) => void;
  workspace: WorkspaceState;
};

export function useWorkspaceActions({
  clearNoteSuggestion,
  displayCategoryName,
  notifyError,
  scheduleUndoableAction,
  selectedListId,
  setSelectedListId,
  workspace,
}: UseWorkspaceActionsArgs) {
  const { t, i18n } = useTranslation();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newListName, setNewListName] = useState('');
  const [listDrafts, setListDrafts] = useState<Record<string, string>>({});
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);

  function mergeRestoredNotes(restoredNotes: Note[]) {
    if (!restoredNotes.length) {
      return;
    }

    workspace.setNotes((current) =>
      [...current.filter((note) => !restoredNotes.some((restored) => restored.id === note.id)), ...restoredNotes].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    );
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newCategoryName.trim();
    if (!name) {
      return;
    }

    try {
      setIsCreatingCategory(true);
      const category = await createCategoryRequest(name);
      workspace.setCategories((current) =>
        [...current, category].sort(
          (a, b) =>
            Number(b.isSystem) - Number(a.isSystem) ||
            a.name.localeCompare(b.name, i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'ru'),
        ),
      );
      setNewCategoryName('');
    } catch (error) {
      notifyError(error, t('notifications.errors.createCategory'));
      return;
    } finally {
      setIsCreatingCategory(false);
    }

    return true;
  }

  function deleteCategory(categoryId: string) {
    const category = workspace.categories.find((entry) => entry.id === categoryId);
    if (!category) return;

    scheduleUndoableAction({
      key: `category:${categoryId}`,
      title: t('notifications.categoryDeletePending', { name: displayCategoryName(category) }),
      optimistic: () => {},
      rollback: () => {},
      commit: async () => {
        const response = await deleteCategoryRequest(categoryId);

        workspace.setCategories((current) => current.filter((entry) => entry.id !== categoryId));
        workspace.setNotes((current) =>
          current.map((note) => {
            if (note.categoryId !== categoryId) {
              return note;
            }

            const fallbackCategory = workspace.categories.find(
              (entry) => entry.id === response.reassignedToCategoryId,
            );

            return {
              ...note,
              categoryId: response.reassignedToCategoryId,
              category: fallbackCategory ?? note.category,
            };
          }),
        );
      },
    });
  }

  async function createList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newListName.trim();
    if (!name) {
      return;
    }

    try {
      setIsCreatingList(true);
      const list = await createListRequest(name);
      workspace.setLists((current) => [list, ...current]);
      setListDrafts((current) => ({ ...current, [list.id]: '' }));
      setNewListName('');
    } catch (error) {
      notifyError(error, t('notifications.errors.createList'));
      return;
    } finally {
      setIsCreatingList(false);
    }

    return true;
  }

  function deleteList(listId: string) {
    const list = workspace.lists.find((entry) => entry.id === listId);
    if (!list) return;

    const originalIndex = workspace.lists.findIndex((entry) => entry.id === listId);
    const wasSelected = selectedListId === listId;

    scheduleUndoableAction({
      key: `list:${listId}`,
      title: t('notifications.listDeletePending', { name: list.name }),
      optimistic: () => {
        workspace.setLists((current) => current.filter((entry) => entry.id !== listId));
        if (wasSelected) {
          setSelectedListId(null);
        }
      },
      rollback: () => {
        workspace.setLists((current) => {
          if (current.some((entry) => entry.id === list.id)) return current;
          const next = [...current];
          next.splice(originalIndex, 0, list);
          return next;
        });
        if (wasSelected) {
          setSelectedListId(listId);
        }
      },
      commit: async () => {
        const response = await deleteListRequest(listId);
        mergeRestoredNotes(response.restoredNotes ?? []);
      },
    });
  }

  async function createListItem(event: FormEvent<HTMLFormElement>, listId: string) {
    event.preventDefault();

    const draft = listDrafts[listId]?.trim();
    if (!draft) {
      return;
    }

    try {
      const item = await createListItemRequest(listId, draft);
      workspace.setLists((current) =>
        current.map((list) =>
          list.id === listId
            ? {
                ...list,
                items: [...list.items, item].sort((a, b) => a.position - b.position),
              }
            : list,
        ),
      );
      setListDrafts((current) => ({ ...current, [listId]: '' }));
      return true;
    } catch (error) {
      notifyError(error, t('notifications.errors.createListItem'));
      return false;
    }
  }

  function deleteListItem(listId: string, itemId: string) {
    const list = workspace.lists.find((entry) => entry.id === listId);
    const item = list?.items.find((entry) => entry.id === itemId);
    const originalIndex = list?.items.findIndex((entry) => entry.id === itemId) ?? -1;
    if (!list || !item || originalIndex < 0) return;

    scheduleUndoableAction({
      key: `list-item:${itemId}`,
      title: t('notifications.listItemDeletePending'),
      optimistic: () => {
        workspace.setLists((current) =>
          current.map((entry) =>
            entry.id === listId
              ? {
                  ...entry,
                  items: entry.items
                    .filter((listItem) => listItem.id !== itemId)
                    .map((listItem, index) => ({ ...listItem, position: index })),
                }
              : entry,
          ),
        );
      },
      rollback: () => {
        workspace.setLists((current) =>
          current.map((entry) => {
            if (entry.id !== listId || entry.items.some((listItem) => listItem.id === item.id)) {
              return entry;
            }

            const nextItems = [...entry.items];
            nextItems.splice(originalIndex, 0, item);
            return {
              ...entry,
              items: nextItems.map((listItem, index) => ({ ...listItem, position: index })),
            };
          }),
        );
      },
      commit: async () => {
        const response = await deleteListItemRequest(listId, itemId);
        if (response.restoredNote) {
          mergeRestoredNotes([response.restoredNote]);
        }
      },
    });
  }

  async function toggleListItem(listId: string, item: ListItem) {
    const optimisticDone = !item.done;
    workspace.setLists((current) =>
      current.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map((entry) =>
                entry.id === item.id ? { ...entry, done: optimisticDone } : entry,
              ),
            }
          : list,
      ),
    );

    try {
      const updatedItem = await updateListItemRequest(listId, item.id, { done: optimisticDone });
      workspace.setLists((current) =>
        current.map((list) =>
          list.id === listId
            ? {
                ...list,
                items: list.items.map((entry) => (entry.id === item.id ? updatedItem : entry)),
              }
            : list,
        ),
      );
    } catch (error) {
      workspace.setLists((current) =>
        current.map((list) =>
          list.id === listId
            ? {
                ...list,
                items: list.items.map((entry) =>
                  entry.id === item.id ? { ...entry, done: item.done } : entry,
                ),
              }
            : list,
        ),
      );
      notifyError(error, t('notifications.errors.updateListItem'));
    }
  }

  async function reorderListItems(listId: string, nextItemIds: string[]) {
    const list = workspace.lists.find((entry) => entry.id === listId);
    if (!list) {
      return;
    }

    if (
      nextItemIds.length !== list.items.length ||
      nextItemIds.some((itemId) => !list.items.some((entry) => entry.id === itemId))
    ) {
      return;
    }

    if (nextItemIds.every((itemId, index) => list.items[index]?.id === itemId)) {
      return;
    }

    const byId = new Map(list.items.map((entry) => [entry.id, entry] as const));
    const reordered = nextItemIds
      .map((itemId) => byId.get(itemId))
      .filter((entry): entry is ListItem => Boolean(entry));
    const optimisticItems = reordered.map((entry, index) => ({ ...entry, position: index }));

    workspace.setLists((current) =>
      current.map((entry) => (entry.id === listId ? { ...entry, items: optimisticItems } : entry)),
    );

    try {
      const updatedItems = await reorderListItemsRequest(listId, reordered.map((entry) => entry.id));
      workspace.setLists((current) =>
        current.map((entry) => (entry.id === listId ? { ...entry, items: updatedItems } : entry)),
      );
    } catch (error) {
      workspace.setLists((current) =>
        current.map((entry) => (entry.id === listId ? { ...entry, items: list.items } : entry)),
      );
      notifyError(error, t('notifications.errors.reorderList'));
    }
  }

  function deleteSelectedNote() {
    if (!workspace.selectedNote) {
      return;
    }

    const note = workspace.selectedNote;
    const originalIndex = workspace.notes.findIndex((entry) => entry.id === note.id);
    const nextSelectedNoteId =
      workspace.notes[originalIndex + 1]?.id ?? workspace.notes[originalIndex - 1]?.id ?? null;

    scheduleUndoableAction({
      key: `note:${note.id}`,
      title: t('notifications.noteDeletePending'),
      optimistic: () => {
        workspace.setNotes((current) => current.filter((entry) => entry.id !== note.id));
        workspace.setSelectedNoteId(nextSelectedNoteId);
        clearNoteSuggestion(note.id);
      },
      rollback: () => {
        workspace.setNotes((current) => {
          if (current.some((entry) => entry.id === note.id)) return current;
          const next = [...current];
          next.splice(originalIndex, 0, note);
          return next;
        });
        workspace.setSelectedNoteId(note.id);
      },
      commit: async () => {
        await deleteNoteRequest(note.id);
      },
    });
  }

  return {
    createCategory,
    createList,
    createListItem,
    deleteCategory,
    deleteList,
    deleteListItem,
    deleteSelectedNote,
    isCreatingCategory,
    isCreatingList,
    listDrafts,
    newCategoryName,
    newListName,
    reorderListItems,
    setListDrafts,
    setNewCategoryName,
    setNewListName,
    toggleListItem,
  };
}
