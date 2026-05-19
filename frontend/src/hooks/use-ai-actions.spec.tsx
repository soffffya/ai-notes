import { act, renderHook, waitFor } from '@testing-library/react';
import type { AiAnalyzeResult, AiUndoResult, ListItem, Note, NotesList } from '@/types';

const notifications = {
  push: vi.fn(),
};

const apiFetchMock = vi.fn();

vi.mock('@/api/client', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock('@/hooks/use-notifications', () => ({
  useNotifications: () => notifications,
}));

import { useAiActions } from './use-ai-actions';

function createWorkspaceState() {
  const state = {
    notes: [] as Note[],
    lists: [] as NotesList[],
    selectedNoteId: null as string | null,
  };

  const workspace = {
    get notes() {
      return state.notes;
    },
    setNotes: vi.fn((updater: Note[] | ((current: Note[]) => Note[])) => {
      state.notes = typeof updater === 'function' ? updater(state.notes) : updater;
    }),
    categories: [],
    setCategories: vi.fn(),
    get lists() {
      return state.lists;
    },
    setLists: vi.fn((updater: NotesList[] | ((current: NotesList[]) => NotesList[])) => {
      state.lists = typeof updater === 'function' ? updater(state.lists) : updater;
    }),
    get selectedNoteId() {
      return state.selectedNoteId;
    },
    setSelectedNoteId: vi.fn((value: string | null) => {
      state.selectedNoteId = value;
    }),
    get selectedNote() {
      return state.notes.find((note) => note.id === state.selectedNoteId) ?? null;
    },
    isBootstrapping: false,
    bootstrapError: null,
    reload: vi.fn(),
  };

  return { state, workspace };
}

describe('useAiActions', () => {
  beforeEach(() => {
    notifications.push.mockReset();
    apiFetchMock.mockReset();
  });

  it('stores suggestion state and exposes apply action via notification', async () => {
    const { workspace } = createWorkspaceState();
    const onError = vi.fn();
    const suggestion: Extract<AiAnalyzeResult, { status: 'suggested' }> = {
      status: 'suggested',
      actionLogId: 'action-1',
      actionType: 'assign_category',
      confidence: 0.7,
      reason: 'looks like work',
      categoryId: 'category-2',
      categoryName: 'Work',
    };

    apiFetchMock.mockResolvedValueOnce(suggestion);

    const { result } = renderHook(() => useAiActions({ onError, workspace: workspace as never }));

    await act(async () => {
      await result.current.analyzeNote('note-1');
    });

    expect(result.current.aiStates['note-1']).toEqual({ phase: 'suggested', result: suggestion });
    expect(notifications.push).toHaveBeenCalledWith(
      'AI suggests moving the note to “Work”',
      'info',
      expect.objectContaining({
        actionLabel: 'Apply',
      }),
    );
  });

  it('restores archived note and removes list item when undoing auto-applied list action', async () => {
    const note: Note = {
      id: 'note-1',
      title: 'Buy milk',
      content: 'Buy milk',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      categoryId: 'category-1',
      category: { id: 'category-1', name: 'Uncategorized', isSystem: true },
    };
    const listItem: ListItem = {
      id: 'item-1',
      text: 'Buy milk',
      done: false,
      position: 0,
      noteId: note.id,
    };
    const { state, workspace } = createWorkspaceState();
    state.notes = [note];
    state.selectedNoteId = note.id;
    state.lists = [
      {
        id: 'list-1',
        name: 'Shopping',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [],
      },
    ];

    const autoApplied: Extract<AiAnalyzeResult, { status: 'auto_applied' }> = {
      status: 'auto_applied',
      actionLogId: 'action-undo',
      undoExpiresAt: new Date(Date.now() + 5_000).toISOString(),
      actionType: 'add_to_list',
      confidence: 0.94,
      reason: 'clearly a shopping item',
      note,
      listId: 'list-1',
      listName: 'Shopping',
      listItem,
    };

    const undoResult: Extract<AiUndoResult, { status: 'undone' }> = {
      status: 'undone',
      actionType: 'add_to_list',
      listId: 'list-1',
      removedListItemId: 'item-1',
      note,
      undoneAt: new Date().toISOString(),
    };

    apiFetchMock.mockResolvedValueOnce(autoApplied).mockResolvedValueOnce(undoResult);

    const { result } = renderHook(() => useAiActions({ onError: vi.fn(), workspace: workspace as never }));

    await act(async () => {
      await result.current.analyzeNote(note.id);
    });

    expect(state.notes).toEqual([]);
    expect(state.lists[0]?.items).toEqual([listItem]);

    const actionOptions = notifications.push.mock.calls.at(-1)?.[2];
    expect(actionOptions?.actionLabel).toBe('Undo');

    await act(async () => {
      await actionOptions?.onAction?.();
    });

    await waitFor(() => {
      expect(state.notes).toHaveLength(1);
    });
    expect(state.lists[0]?.items).toEqual([]);
    expect(workspace.setSelectedNoteId).toHaveBeenCalledWith(note.id);
    expect(notifications.push).toHaveBeenLastCalledWith('AI action reverted', 'success');
  });
});
