import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

export type NotificationKind = 'success' | 'error' | 'info';

export type NotificationItem = {
  id: string;
  title: string;
  kind: NotificationKind;
  actionLabel?: string;
  onAction?: () => void;
  expiresAt?: number;
};

type NotificationsContextValue = {
  items: NotificationItem[];
  push: (
    title: string,
    kind?: NotificationKind,
    options?: { actionLabel?: string; onAction?: () => void; durationMs?: number },
  ) => void;
  remove: (id: string) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<NotificationItem[]>([]);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (
      title: string,
      kind: NotificationKind = 'info',
      options?: { actionLabel?: string; onAction?: () => void; durationMs?: number },
    ) => {
      const id = crypto.randomUUID();
      setItems((current) => [
        ...current,
        {
          id,
          title,
          kind,
          actionLabel: options?.actionLabel,
          onAction: options?.onAction,
          expiresAt: options?.durationMs ? Date.now() + options.durationMs : undefined,
        },
      ]);
      window.setTimeout(() => remove(id), options?.durationMs ?? 3200);
    },
    [remove],
  );

  const value = useMemo(
    () => ({
      items,
      push,
      remove,
    }),
    [items, push, remove],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }

  return context;
}
