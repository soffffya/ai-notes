import { useEffect, useRef, useState } from 'react';
import { loadWorkspace } from '@/api/workspace';
import i18n from '@/i18n';
import type { Category, ListItem, Note, NotesList } from '@/types';

export function useWorkspaceData(enabled = true) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lists, setLists] = useState<NotesList[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(enabled);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setIsBootstrapping(true);
      setBootstrapError(null);

      try {
        const { notes: nextNotes, categories: nextCategories, lists: nextLists } = await loadWorkspace();

        if (cancelled || !activeRef.current) {
          return;
        }

        setNotes(nextNotes);
        setCategories(nextCategories);
        setLists(nextLists);
        setSelectedNoteId((current) => current ?? nextNotes[0]?.id ?? null);
      } catch (error) {
        if (!cancelled && activeRef.current) {
          setBootstrapError(
            error instanceof Error ? error.message : i18n.t('notifications.errors.loadWorkspace'),
          );
        }
      } finally {
        if (!cancelled && activeRef.current) {
          setIsBootstrapping(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [enabled, reloadToken]);

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;

  return {
    notes,
    setNotes,
    categories,
    setCategories,
    lists,
    setLists,
    selectedNoteId,
    setSelectedNoteId,
    selectedNote,
    isBootstrapping,
    bootstrapError,
    reload: () => setReloadToken((current) => current + 1),
  };
}

export type WorkspaceState = ReturnType<typeof useWorkspaceData>;
export type WorkspaceNotePayload = Partial<Pick<Note, 'title' | 'content' | 'categoryId'>>;
export type WorkspaceListItemPayload = Partial<Pick<ListItem, 'done' | 'text'>>;
