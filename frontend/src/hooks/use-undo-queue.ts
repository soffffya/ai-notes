import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/hooks/use-notifications';

type UndoableAction = {
  key: string;
  title: string;
  optimistic: () => void;
  rollback: () => void;
  commit: () => Promise<void>;
};

export function useUndoQueue(onError: (error: unknown, fallback: string) => void, undoMs = 5000) {
  const { t } = useTranslation();
  const notifications = useNotifications();
  const pendingUndoRef = useRef<Record<string, { timeoutId: number; rollback: () => void }>>({});

  useEffect(() => {
    return () => {
      Object.values(pendingUndoRef.current).forEach((entry) => {
        window.clearTimeout(entry.timeoutId);
      });
      pendingUndoRef.current = {};
    };
  }, []);

  function scheduleUndoableAction({ key, title, optimistic, rollback, commit }: UndoableAction) {
    if (pendingUndoRef.current[key]) {
      return;
    }

    optimistic();

    const timeoutId = window.setTimeout(async () => {
      delete pendingUndoRef.current[key];
      try {
        await commit();
      } catch (error) {
        rollback();
        onError(error, t('notifications.errors.completeAction'));
      }
    }, undoMs);

    pendingUndoRef.current[key] = {
      timeoutId,
      rollback,
    };

    notifications.push(title, 'info', {
      actionLabel: t('common.undo'),
      durationMs: undoMs,
      onAction: () => {
        const pending = pendingUndoRef.current[key];
        if (!pending) {
          return;
        }

        window.clearTimeout(pending.timeoutId);
        pending.rollback();
        delete pendingUndoRef.current[key];
        notifications.push(t('notifications.genericActionUndone'), 'success');
      },
    });
  }

  return { scheduleUndoableAction };
}
