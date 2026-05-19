import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import HomeSidebar from '@/components/home/HomeSidebar';
import ListDetails from '@/components/home/ListDetails';
import NoteDetails from '@/components/home/NoteDetails';
import NoteEditorDialog from '@/components/home/NoteEditorDialog';
import type { SidebarMode } from '@/components/home/types';
import SettingsDialog from '@/components/settings-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Category, ListItem, Note, NotesList } from '@/types';
import { useAiActions } from '@/hooks/use-ai-actions';
import { useAuth } from '@/hooks/use-auth';
import { useListDnD } from '@/hooks/use-list-dnd';
import { useNoteEditor } from '@/hooks/use-note-editor';
import { useNotifications } from '@/hooks/use-notifications';
import { useUndoQueue } from '@/hooks/use-undo-queue';
import { useWorkspaceData } from '@/hooks/use-workspace-data';
import { apiFetch } from '@/api/client';

const OPENAI_KEY_STORAGE = 'openaiApiKey';

export default function HomePage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const notifications = useNotifications();
  const workspace = useWorkspaceData(auth.isAuthenticated);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newListName, setNewListName] = useState('');
  const [listDrafts, setListDrafts] = useState<Record<string, string>>({});
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('notes');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  function notifyError(error: unknown, fallback: string) {
    notifications.push(error instanceof Error ? error.message || fallback : fallback, 'error');
  }

  const aiActions = useAiActions({
    onError: notifyError,
    workspace,
  });

  const noteEditor = useNoteEditor({
    categories: workspace.categories,
    onAnalyzeNote: aiActions.analyzeNote,
    onError: notifyError,
    workspace,
  });

  const { scheduleUndoableAction } = useUndoQueue(notifyError);
  const listDnD = useListDnD({
    lists: workspace.lists,
    reorderListItems,
  });

  function displayCategoryName(category?: Category | null) {
    if (!category) return t('home.systemCategory');
    return category.isSystem ? t('home.systemCategory') : category.name;
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }

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

  async function logout() {
    auth.logout();
    await navigate('/auth');
  }

  const filteredNotes =
    selectedCategoryFilter === 'all'
      ? workspace.notes
      : workspace.notes.filter((note) => note.categoryId === selectedCategoryFilter);

  useEffect(() => {
    if (!filteredNotes.length) {
      workspace.setSelectedNoteId(null);
      return;
    }

    if (!filteredNotes.some((note) => note.id === workspace.selectedNoteId)) {
      workspace.setSelectedNoteId(filteredNotes[0].id);
    }
  }, [filteredNotes, workspace]);

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newCategoryName.trim();
    if (!name) {
      return;
    }

    try {
      setIsCreatingCategory(true);
      const category = await apiFetch<Category>('/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      workspace.setCategories((current) =>
        [...current, category].sort(
          (a, b) =>
            Number(b.isSystem) - Number(a.isSystem) ||
            a.name.localeCompare(b.name, i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'ru'),
        ),
      );
      setNewCategoryName('');
      notifications.push(t('notifications.categoryCreated'), 'success');
    } catch (error) {
      notifyError(error, t('notifications.errors.createCategory'));
    } finally {
      setIsCreatingCategory(false);
    }
  }

  async function deleteCategory(categoryId: string) {
    const category = workspace.categories.find((entry) => entry.id === categoryId);
    if (!category) return;

    scheduleUndoableAction({
      key: `category:${categoryId}`,
      title: t('notifications.categoryDeletePending', { name: displayCategoryName(category) }),
      optimistic: () => {},
      rollback: () => {},
      commit: async () => {
        const response = await apiFetch<{ success: boolean; reassignedToCategoryId: string }>(
          `/categories/${categoryId}`,
          {
            method: 'DELETE',
          },
        );

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
        notifications.push(t('notifications.categoryDeletedReassigned'), 'success');
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
      const list = await apiFetch<NotesList>('/lists', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      workspace.setLists((current) => [list, ...current]);
      setListDrafts((current) => ({ ...current, [list.id]: '' }));
      setNewListName('');
      notifications.push(t('notifications.listCreated'), 'success');
    } catch (error) {
      notifyError(error, t('notifications.errors.createList'));
    } finally {
      setIsCreatingList(false);
    }
  }

  async function deleteList(listId: string) {
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
        const response = await apiFetch<{ success: boolean; restoredNotes: Note[] }>(`/lists/${listId}`, {
          method: 'DELETE',
        });
        mergeRestoredNotes(response.restoredNotes ?? []);
        notifications.push(t('notifications.listDeleted'), 'success');
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
      const item = await apiFetch<ListItem>(`/lists/${listId}/items`, {
        method: 'POST',
        body: JSON.stringify({ text: draft }),
      });
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
      notifications.push(t('notifications.listItemAdded'), 'success');
    } catch (error) {
      notifyError(error, t('notifications.errors.createListItem'));
    }
  }

  async function deleteListItem(listId: string, itemId: string) {
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
        const response = await apiFetch<{ success: boolean; restoredNote?: Note | null }>(
          `/lists/${listId}/items/${itemId}`,
          { method: 'DELETE' },
        );
        if (response.restoredNote) {
          mergeRestoredNotes([response.restoredNote]);
        }
        notifications.push(t('notifications.listItemDeleted'), 'success');
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
      const updatedItem = await apiFetch<ListItem>(`/lists/${listId}/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ done: optimisticDone }),
      });
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
      const updatedItems = await apiFetch<ListItem[]>(`/lists/${listId}/items/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ itemIds: reordered.map((entry) => entry.id) }),
      });
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

  async function deleteSelectedNote() {
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
        aiActions.clearSuggestion(note.id);
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
        await apiFetch(`/notes/${note.id}`, { method: 'DELETE' });
        notifications.push(t('notifications.noteDeleted'), 'success');
      },
    });
  }

  function openCreateEditor() {
    setSidebarMode('notes');
    setSelectedListId(null);
    noteEditor.openCreateEditor();
  }

  function openEditEditor(note: Note) {
    setSelectedListId(null);
    noteEditor.openEditEditor(note);
  }

  function selectNote(noteId: string) {
    setSidebarMode('notes');
    setSelectedListId(null);
    workspace.setSelectedNoteId(noteId);
  }

  function selectList(listId: string) {
    setSidebarMode('lists');
    setSelectedListId(listId);
  }

  const saveStateLabel =
    noteEditor.saveState === 'saving'
      ? t('home.saveState.saving')
      : noteEditor.saveState === 'saved'
        ? t('home.saveState.saved')
        : noteEditor.saveState === 'error'
          ? t('home.saveState.error')
          : t('home.saveState.idle');
  const selectedList = workspace.lists.find((list) => list.id === selectedListId) ?? null;
  const selectedNote = filteredNotes.find((note) => note.id === workspace.selectedNoteId) ?? null;
  const selectedAiState = selectedNote ? aiActions.aiStates[selectedNote.id] : undefined;
  const selectedNoteId = selectedNote?.id ?? null;

  if (workspace.isBootstrapping) {
    return (
      <main className="container flex min-h-screen items-center justify-center py-12">
        <div className="rounded-[28px] border border-border/70 bg-card/90 px-6 py-5 text-card-foreground shadow-soft backdrop-blur-xl">
          {t('app.loadingWorkspace')}
        </div>
      </main>
    );
  }

  if (workspace.bootstrapError) {
    return (
      <main className="container flex min-h-screen items-center justify-center py-12">
        <div className="w-full max-w-xl rounded-[28px] border border-destructive/30 bg-card/95 p-6 shadow-soft backdrop-blur-xl">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-700">
            {t('app.loadErrorTitle')}
          </p>
          <p className="mt-3 text-sm text-red-800">{workspace.bootstrapError}</p>
          <div className="mt-5 flex gap-3">
            <Button onClick={() => workspace.reload()} type="button">
              {t('common.retry')}
            </Button>
            <Button onClick={() => void logout()} type="button" variant="outline">
              {t('common.logout')}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1520px] px-4 py-5 md:px-6 md:py-6">
      <section className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <HomeSidebar
          categories={workspace.categories}
          displayCategoryName={displayCategoryName}
          email={auth.user?.email ?? ''}
          filteredNotes={filteredNotes}
          formatDate={formatDate}
          isCreatingCategory={isCreatingCategory}
          isCreatingList={isCreatingList}
          lists={workspace.lists}
          newCategoryName={newCategoryName}
          newListName={newListName}
          notes={workspace.notes}
          onCreateCategory={(event) => void createCategory(event)}
          onCreateList={(event) => void createList(event)}
          onDeleteCategory={(categoryId) => void deleteCategory(categoryId)}
          onNewCategoryNameChange={setNewCategoryName}
          onNewListNameChange={setNewListName}
          onOpenCreateEditor={openCreateEditor}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSelectCategoryFilter={(value) => {
            setSelectedListId(null);
            setSelectedCategoryFilter(value);
          }}
          onSelectList={selectList}
          onSelectNote={selectNote}
          onSidebarModeChange={setSidebarMode}
          selectedCategoryFilter={selectedCategoryFilter}
          selectedListId={selectedListId}
          selectedNoteId={selectedNoteId}
          sidebarMode={sidebarMode}
        />

        <section className="space-y-4">
          <Card>
            <CardContent className="p-6">
              {selectedList ? (
                <ListDetails
                  dragState={listDnD.dragState}
                  draft={listDrafts[selectedList.id] ?? ''}
                  dropIndicator={listDnD.dropIndicator}
                  list={selectedList}
                  onCreateItem={(event) => void createListItem(event, selectedList.id)}
                  onDeleteItem={(itemId) => void deleteListItem(selectedList.id, itemId)}
                  onDeleteList={() => void deleteList(selectedList.id)}
                  onDraftChange={(value) =>
                    setListDrafts((current) => ({ ...current, [selectedList.id]: value }))
                  }
                  onDragEnd={listDnD.handleListItemDragEnd}
                  onDragOver={listDnD.handleListItemDragOver}
                  onDragStart={listDnD.handleListItemDragStart}
                  onDrop={(listId, itemId) => void listDnD.handleListItemDrop(listId, itemId)}
                  onToggleItem={(item) => void toggleListItem(selectedList.id, item)}
                />
              ) : selectedNote ? (
                <NoteDetails
                  displayCategoryName={displayCategoryName}
                  formatDate={formatDate}
                  note={selectedNote}
                  noteAiState={selectedAiState}
                  onApplySuggestion={(actionLogId) => void aiActions.applySuggestion(actionLogId, selectedNote.id)}
                  onDelete={() => void deleteSelectedNote()}
                  onEdit={() => openEditEditor(selectedNote)}
                  onHideSuggestion={() => aiActions.clearSuggestion(selectedNoteId)}
                />
              ) : (
                <div className="rounded-[24px] border border-dashed border-border bg-muted/30 p-8 text-sm text-muted-foreground">
                  {t('home.emptyWorkspace')}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </section>

      <NoteEditorDialog
        categories={workspace.categories}
        displayCategoryName={displayCategoryName}
        editor={noteEditor.editor}
        editorMode={noteEditor.editorMode}
        onClose={noteEditor.closeEditor}
        onCreateNote={() => void noteEditor.createNote()}
        onEditorChange={noteEditor.setEditor}
        open={noteEditor.isEditorOpen}
        saveStateLabel={saveStateLabel}
      />

      <SettingsDialog
        email={auth.user?.email ?? ''}
        onLogout={() => void logout()}
        onOpenChange={setIsSettingsOpen}
        onSaveApiKey={(value) => {
          const normalized = value.trim();
          if (normalized) {
            localStorage.setItem(OPENAI_KEY_STORAGE, normalized);
            notifications.push(t('notifications.openAiKeySaved'), 'success');
          } else {
            localStorage.removeItem(OPENAI_KEY_STORAGE);
            notifications.push(t('notifications.openAiKeyRemoved'), 'info');
          }
          setIsSettingsOpen(false);
        }}
        open={isSettingsOpen}
      />
    </main>
  );
}
