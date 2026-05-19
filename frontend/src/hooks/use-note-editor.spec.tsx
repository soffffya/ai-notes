import { act, renderHook } from '@testing-library/react';
import type { Category, Note } from '@/types';

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

import { useNoteEditor } from './use-note-editor';

function createWorkspaceState(selectedNote: Note | null) {
  const state = {
    notes: selectedNote ? [selectedNote] : ([] as Note[]),
    selectedNoteId: selectedNote?.id ?? null,
  };

  const workspace = {
    get notes() {
      return state.notes;
    },
    setNotes: vi.fn((updater: Note[] | ((current: Note[]) => Note[])) => {
      state.notes = typeof updater === 'function' ? updater(state.notes) : updater;
    }),
    categories: [] as Category[],
    setCategories: vi.fn(),
    lists: [],
    setLists: vi.fn(),
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

describe('useNoteEditor', () => {
  const categories: Category[] = [{ id: 'category-1', name: 'Uncategorized', isSystem: true }];

  beforeEach(() => {
    vi.useFakeTimers();
    apiFetchMock.mockReset();
    notifications.push.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates note and triggers AI analysis callback', async () => {
    const createdNote: Note = {
      id: 'note-2',
      title: 'Fresh note',
      content: 'Fresh note',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      categoryId: 'category-1',
      category: categories[0],
    };
    const { state, workspace } = createWorkspaceState(null);
    const onAnalyzeNote = vi.fn();

    apiFetchMock.mockResolvedValueOnce(createdNote);

    const { result } = renderHook(() =>
      useNoteEditor({
        categories,
        onAnalyzeNote,
        onError: vi.fn(),
        workspace: workspace as never,
      }),
    );

    act(() => {
      result.current.openCreateEditor();
      result.current.setEditor({
        title: 'Fresh note',
        content: 'Fresh note',
        categoryId: 'category-1',
      });
    });

    await act(async () => {
      await result.current.createNote();
    });

    expect(state.notes[0]).toEqual(createdNote);
    expect(workspace.setSelectedNoteId).toHaveBeenCalledWith(createdNote.id);
    expect(result.current.isEditorOpen).toBe(false);
    expect(onAnalyzeNote).toHaveBeenCalledWith(createdNote.id);
    expect(notifications.push).toHaveBeenCalledWith('Note created', 'success');
  });

  it('autosaves edited note after debounce and re-analyzes it', async () => {
    const existingNote: Note = {
      id: 'note-1',
      title: 'Old title',
      content: 'Old content',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      categoryId: 'category-1',
      category: categories[0],
    };
    const savedNote: Note = {
      ...existingNote,
      title: 'Updated title',
      content: 'Updated content',
      updatedAt: new Date(Date.now() + 1000).toISOString(),
    };
    const { state, workspace } = createWorkspaceState(existingNote);
    const onAnalyzeNote = vi.fn();

    apiFetchMock.mockResolvedValueOnce(savedNote);

    const { result } = renderHook(() =>
      useNoteEditor({
        categories,
        onAnalyzeNote,
        onError: vi.fn(),
        workspace: workspace as never,
      }),
    );

    act(() => {
      result.current.openEditEditor(existingNote);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    act(() => {
      result.current.setEditor({
        title: 'Updated title',
        content: 'Updated content',
        categoryId: 'category-1',
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(701);
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/notes/note-1', expect.objectContaining({ method: 'PATCH' }));
    expect(state.notes[0]).toEqual(savedNote);
    expect(onAnalyzeNote).toHaveBeenCalledWith(savedNote.id);
  });
});
