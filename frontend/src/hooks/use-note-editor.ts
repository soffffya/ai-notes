import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EditorMode, NoteEditorState, SaveState } from '@/components/home/types';
import { createNote as createNoteRequest, updateNote as updateNoteRequest } from '@/api/workspace';
import { useNotifications } from '@/hooks/use-notifications';
import type { WorkspaceState } from '@/hooks/use-workspace-data';
import type { Category, Note } from '@/types';

type UseNoteEditorArgs = {
  categories: Category[];
  onAnalyzeNote?: (noteId: string) => void;
  onError: (error: unknown, fallback: string) => void;
  workspace: WorkspaceState;
};

export function useNoteEditor({ categories, onAnalyzeNote, onError, workspace }: UseNoteEditorArgs) {
  const { t } = useTranslation();
  const notifications = useNotifications();
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('edit');
  const [editor, setEditor] = useState<NoteEditorState>({
    title: '',
    content: '',
    categoryId: '',
  });
  const syncFromStoreRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!workspace.selectedNote) {
      setEditor({ title: '', content: '', categoryId: '' });
      setSaveState('idle');
      return;
    }

    syncFromStoreRef.current = true;
    setEditor({
      title: workspace.selectedNote.title ?? '',
      content: workspace.selectedNote.content,
      categoryId: workspace.selectedNote.categoryId,
    });
    setSaveState('idle');

    const frame = window.setTimeout(() => {
      syncFromStoreRef.current = false;
    }, 0);

    return () => window.clearTimeout(frame);
  }, [workspace.selectedNote]);

  useEffect(() => {
    if (!isEditorOpen || editorMode !== 'edit' || syncFromStoreRef.current || !workspace.selectedNote) {
      return;
    }

    if (
      editor.title === (workspace.selectedNote.title ?? '') &&
      editor.content === workspace.selectedNote.content &&
      editor.categoryId === workspace.selectedNote.categoryId
    ) {
      setSaveState('idle');
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    setSaveState('saving');
    autosaveTimerRef.current = window.setTimeout(async () => {
      try {
        const note = await updateNoteRequest(workspace.selectedNote!.id, {
          title: editor.title || undefined,
          content: editor.content,
          categoryId: editor.categoryId,
        });

        workspace.setNotes((current) =>
          current
            .map((entry) => (entry.id === note.id ? note : entry))
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        );
        setSaveState('saved');
        onAnalyzeNote?.(note.id);
      } catch (error) {
        setSaveState('error');
        onError(error, t('notifications.errors.saveNote'));
      }
    }, 700);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [editor, editorMode, isEditorOpen, onAnalyzeNote, onError, t, workspace]);

  function openCreateEditor() {
    const defaultCategoryId =
      categories.find((category) => category.isSystem)?.id ?? categories[0]?.id ?? '';

    syncFromStoreRef.current = true;
    setEditorMode('create');
    setEditor({
      title: '',
      content: '',
      categoryId: defaultCategoryId,
    });
    setSaveState('idle');
    setIsEditorOpen(true);
    window.setTimeout(() => {
      syncFromStoreRef.current = false;
    }, 0);
  }

  function openEditEditor(note: Note) {
    workspace.setSelectedNoteId(note.id);
    setEditorMode('edit');
    setIsEditorOpen(true);
  }

  async function createNote() {
    const content = editor.content.trim();
    if (!content) {
      return;
    }

    setSaveState('saving');

    try {
      const note = await createNoteRequest({
        title: editor.title.trim() || undefined,
        content,
      });

      workspace.setNotes((current) => [note, ...current]);
      workspace.setSelectedNoteId(note.id);
      setEditorMode('edit');
      setIsEditorOpen(false);
      setSaveState('saved');
      notifications.push(t('notifications.noteCreated'), 'success');
      onAnalyzeNote?.(note.id);
    } catch (error) {
      setSaveState('error');
      onError(error, t('notifications.errors.createNote'));
    }
  }

  function closeEditor() {
    setIsEditorOpen(false);
  }

  function setEditorCategoryId(categoryId: string) {
    setEditor((current) => ({ ...current, categoryId }));
  }

  return {
    editor,
    setEditor,
    editorMode,
    isEditorOpen,
    saveState,
    setSaveState,
    openCreateEditor,
    openEditEditor,
    closeEditor,
    createNote,
    setEditorCategoryId,
  };
}
