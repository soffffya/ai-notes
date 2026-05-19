import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NoteAiUiState } from '@/components/home/types';
import { apiFetch } from '@/api/client';
import { useNotifications } from '@/hooks/use-notifications';
import type { WorkspaceState } from '@/hooks/use-workspace-data';
import type { AiAnalyzeResult, AiUndoResult } from '@/types';

type UseAiActionsArgs = {
  onError: (error: unknown, fallback: string) => void;
  workspace: WorkspaceState;
};

export function useAiActions({ onError, workspace }: UseAiActionsArgs) {
  const { t } = useTranslation();
  const notifications = useNotifications();
  const [aiStates, setAiStates] = useState<Record<string, NoteAiUiState | undefined>>({});
  const missingAiKeyNoticeRef = useRef(false);
  const aiQueueRef = useRef<Record<string, { inFlight: boolean; queued: boolean }>>({});

  async function undoAiAction(actionLogId: string) {
    try {
      const result = await apiFetch<AiUndoResult>(`/ai/undo/${actionLogId}`, {
        method: 'POST',
      });

      if (result.status === 'expired') {
        notifications.push(t('notifications.aiUndoExpired'), 'info');
        return;
      }

      if (result.actionType === 'assign_category' && result.note) {
        workspace.setNotes((current) =>
          current
            .map((entry) => (entry.id === result.note!.id ? result.note! : entry))
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        );
      }

      if (result.actionType === 'add_to_list' && result.listId && result.removedListItemId) {
        workspace.setLists((current) =>
          current.map((list) =>
            list.id === result.listId
              ? {
                  ...list,
                  items: list.items
                    .filter((item) => item.id !== result.removedListItemId)
                    .map((item, index) => ({ ...item, position: index })),
                }
              : list,
          ),
        );
      }

      if (result.actionType === 'add_to_list' && result.note) {
        workspace.setNotes((current) =>
          [...current.filter((entry) => entry.id !== result.note!.id), result.note!].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          ),
        );
        workspace.setSelectedNoteId(result.note.id);
      }

      notifications.push(t('notifications.aiActionUndone'), 'success');
    } catch (error) {
      onError(error, t('notifications.errors.undoAi'));
    }
  }

  function getSuggestionLabel(result: Extract<AiAnalyzeResult, { status: 'suggested' }>) {
    return result.actionType === 'assign_category'
      ? t('notifications.aiSuggestCategory', { category: result.categoryName })
      : t('notifications.aiSuggestList', { list: result.listName });
  }

  function handleAiResult(noteId: string, result: AiAnalyzeResult) {
    if (result.status === 'skipped') {
      if (result.reason === 'missing-openai-key' && !missingAiKeyNoticeRef.current) {
        notifications.push(t('notifications.missingAiKey'), 'info');
        missingAiKeyNoticeRef.current = true;
      }
      setAiStates((current) => ({
        ...current,
        [noteId]: { phase: 'idle' },
      }));
      return;
    }

    if (result.status === 'low_confidence' || result.status === 'missing-note') {
      setAiStates((current) => ({
        ...current,
        [noteId]: { phase: 'idle' },
      }));
      return;
    }

    if (result.status === 'suggested') {
      setAiStates((current) => ({
        ...current,
        [noteId]: { phase: 'suggested', result },
      }));
      notifications.push(getSuggestionLabel(result), 'info', {
        actionLabel: t('common.apply'),
        durationMs: 7000,
        onAction: () => {
          void applySuggestion(result.actionLogId, noteId);
        },
      });
      return;
    }

    if (result.status === 'auto_applied') {
      setAiStates((current) => ({
        ...current,
        [noteId]: { phase: 'idle' },
      }));

      if (result.actionType === 'assign_category') {
        workspace.setNotes((current) =>
          current
            .map((entry) => (entry.id === result.note.id ? result.note : entry))
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        );
        notifications.push(
          t('notifications.aiMovedCategory', {
            category: result.categoryName ?? t('home.systemCategory'),
          }),
          'success',
          result.actionLogId
            ? {
                actionLabel: t('common.undo'),
                durationMs: Math.max(0, new Date(result.undoExpiresAt).getTime() - Date.now()),
                onAction: () => {
                  void undoAiAction(result.actionLogId);
                },
              }
            : undefined,
        );
      }

      if (result.actionType === 'add_to_list' && result.listId && result.listItem) {
        const remainingNotes = workspace.notes.filter((entry) => entry.id !== result.note.id);
        workspace.setNotes(remainingNotes);

        if (workspace.selectedNoteId === result.note.id) {
          workspace.setSelectedNoteId(remainingNotes[0]?.id ?? null);
        }

        workspace.setLists((current) =>
          current.map((list) =>
            list.id === result.listId
              ? {
                  ...list,
                  items: [...list.items, result.listItem!].sort((a, b) => a.position - b.position),
                }
              : list,
          ),
        );
        notifications.push(
          t('notifications.aiTurnedIntoListItem', {
            list: result.listName ?? t('common.lists'),
          }),
          'success',
          result.actionLogId
            ? {
                actionLabel: t('common.undo'),
                durationMs: Math.max(0, new Date(result.undoExpiresAt).getTime() - Date.now()),
                onAction: () => {
                  void undoAiAction(result.actionLogId);
                },
              }
            : undefined,
        );
      }
    }
  }

  async function analyzeNote(noteId: string) {
    const queueState = aiQueueRef.current[noteId] ?? { inFlight: false, queued: false };
    if (queueState.inFlight) {
      aiQueueRef.current[noteId] = { ...queueState, queued: true };
      return;
    }

    aiQueueRef.current[noteId] = { inFlight: true, queued: false };
    setAiStates((current) => ({
      ...current,
      [noteId]: { phase: 'analyzing' },
    }));

    try {
      const result = await apiFetch<AiAnalyzeResult>(`/ai/analyze/${noteId}`, {
        method: 'POST',
      });
      handleAiResult(noteId, result);
    } catch (error) {
      setAiStates((current) => ({
        ...current,
        [noteId]: {
          phase: 'error',
          message: error instanceof Error ? error.message : t('notifications.errors.analyzeAi'),
        },
      }));
    } finally {
      const currentQueueState = aiQueueRef.current[noteId];
      if (currentQueueState?.queued) {
        aiQueueRef.current[noteId] = { inFlight: false, queued: false };
        void analyzeNote(noteId);
      } else {
        delete aiQueueRef.current[noteId];
      }
    }
  }

  async function applySuggestion(actionLogId: string, noteId: string) {
    try {
      const result = await apiFetch<AiAnalyzeResult>(`/ai/apply/${actionLogId}`, {
        method: 'POST',
      });
      handleAiResult(noteId, result);
    } catch (error) {
      onError(error, t('notifications.errors.applySuggestion'));
    }
  }

  function clearSuggestion(noteId: string | null) {
    if (!noteId) {
      return;
    }

    setAiStates((current) => {
      const next = { ...current };
      delete next[noteId];
      return next;
    });
  }

  return {
    aiStates,
    analyzeNote,
    applySuggestion,
    clearSuggestion,
  };
}
