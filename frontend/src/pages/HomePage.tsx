import { useEffect, useState } from 'react';
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
import type { Category, Note } from '@/types';
import { useAiActions } from '@/hooks/use-ai-actions';
import { useAuth } from '@/hooks/use-auth';
import { useListDnD } from '@/hooks/use-list-dnd';
import { useNoteEditor } from '@/hooks/use-note-editor';
import { useNotifications } from '@/hooks/use-notifications';
import { useUndoQueue } from '@/hooks/use-undo-queue';
import { useWorkspaceActions } from '@/hooks/use-workspace-actions';
import { useWorkspaceData } from '@/hooks/use-workspace-data';

const OPENAI_KEY_STORAGE = 'openaiApiKey';

export default function HomePage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const notifications = useNotifications();
  const workspace = useWorkspaceData(auth.isAuthenticated);
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

  async function logout() {
    auth.logout();
    await navigate('/auth');
  }

  const workspaceActions = useWorkspaceActions({
    clearNoteSuggestion: aiActions.clearSuggestion,
    displayCategoryName,
    notifyError,
    scheduleUndoableAction,
    selectedListId,
    setSelectedListId,
    workspace,
  });

  const listDnD = useListDnD({
    lists: workspace.lists,
    reorderListItems: workspaceActions.reorderListItems,
  });

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
          isCreatingCategory={workspaceActions.isCreatingCategory}
          isCreatingList={workspaceActions.isCreatingList}
          lists={workspace.lists}
          newCategoryName={workspaceActions.newCategoryName}
          newListName={workspaceActions.newListName}
          notes={workspace.notes}
          onCreateCategory={(event) => void workspaceActions.createCategory(event).then((created) => {
            if (created) notifications.push(t('notifications.categoryCreated'), 'success');
          })}
          onCreateList={(event) => void workspaceActions.createList(event).then((created) => {
            if (created) notifications.push(t('notifications.listCreated'), 'success');
          })}
          onDeleteCategory={workspaceActions.deleteCategory}
          onNewCategoryNameChange={workspaceActions.setNewCategoryName}
          onNewListNameChange={workspaceActions.setNewListName}
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
                  draft={workspaceActions.listDrafts[selectedList.id] ?? ''}
                  dropIndicator={listDnD.dropIndicator}
                  list={selectedList}
                  onCreateItem={(event) => void workspaceActions.createListItem(event, selectedList.id).then((created) => {
                    if (created) notifications.push(t('notifications.listItemAdded'), 'success');
                  })}
                  onDeleteItem={(itemId) => workspaceActions.deleteListItem(selectedList.id, itemId)}
                  onDeleteList={() => workspaceActions.deleteList(selectedList.id)}
                  onDraftChange={(value) =>
                    workspaceActions.setListDrafts((current) => ({ ...current, [selectedList.id]: value }))
                  }
                  onDragEnd={listDnD.handleListItemDragEnd}
                  onDragOver={listDnD.handleListItemDragOver}
                  onDragStart={listDnD.handleListItemDragStart}
                  onDrop={(listId, itemId) => void listDnD.handleListItemDrop(listId, itemId)}
                  onToggleItem={(item) => void workspaceActions.toggleListItem(selectedList.id, item)}
                />
              ) : selectedNote ? (
                <NoteDetails
                  displayCategoryName={displayCategoryName}
                  formatDate={formatDate}
                  note={selectedNote}
                  noteAiState={selectedAiState}
                  onApplySuggestion={(actionLogId) => void aiActions.applySuggestion(actionLogId, selectedNote.id)}
                  onDelete={() => workspaceActions.deleteSelectedNote()}
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
