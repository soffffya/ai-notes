import { useEffect, useState } from 'react';
import { useNotifications } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';

const classes = {
  success: 'border-emerald-500/35 bg-card/95 text-card-foreground',
  error: 'border-red-500/35 bg-card/95 text-card-foreground',
  info:
    'border-border bg-card/95 text-card-foreground dark:border-border/80 dark:bg-card/95 dark:text-card-foreground',
} as const;

export default function NotificationsViewport() {
  const { items, remove } = useNotifications();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'pointer-events-auto rounded-2xl border px-4 py-3 shadow-soft backdrop-blur-xl',
            classes[item.kind],
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              {item.actionLabel && item.onAction ? (
                <button
                  className="mt-2 text-sm font-semibold underline underline-offset-4 opacity-90 transition hover:opacity-100"
                  onClick={() => {
                    item.onAction?.();
                    remove(item.id);
                  }}
                  type="button"
                >
                  {item.actionLabel}
                  {item.expiresAt ? ` (${Math.max(0, Math.ceil((item.expiresAt - now) / 1000))}s)` : ''}
                </button>
              ) : null}
            </div>
            <button
              className="text-xs text-current opacity-70 transition hover:opacity-100"
              onClick={() => remove(item.id)}
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
