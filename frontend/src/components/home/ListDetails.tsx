import type { DragEvent, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DragState, DropIndicator } from './types';
import type { ListItem, NotesList } from '@/types';

type ListDetailsProps = {
  list: NotesList;
  draft: string;
  onDraftChange: (value: string) => void;
  onCreateItem: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteList: () => void;
  onToggleItem: (item: ListItem) => void;
  onDeleteItem: (itemId: string) => void;
  dragState: DragState;
  dropIndicator: DropIndicator;
  onDragStart: (listId: string, itemId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, listId: string, itemId: string) => void;
  onDrop: (listId: string, itemId: string) => void;
};

export default function ListDetails({
  list,
  draft,
  onDraftChange,
  onCreateItem,
  onDeleteList,
  onToggleItem,
  onDeleteItem,
  dragState,
  dropIndicator,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: ListDetailsProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {t('home.listView')}
          </p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-foreground">{list.name}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
              {t('home.listItemsCount', { count: list.items.length })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={onDeleteList} size="sm" type="button" variant="outline">
            {t('home.deleteList')}
          </Button>
        </div>
      </div>

      <form className="flex gap-3" onSubmit={onCreateItem}>
        <Input
          className="min-w-0 flex-1"
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={t('home.addListItemPlaceholder')}
          value={draft}
        />
        <Button type="submit">{t('common.add')}</Button>
      </form>

      <div className="grid gap-3">
        {list.items.map((item) => (
          <div
            key={item.id}
            className={`rounded-[18px] border bg-card/75 p-4 transition ${
              dragState?.itemId === item.id
                ? 'border-primary/40 opacity-60'
                : dragState?.listId === list.id
                  ? 'border-border hover:border-primary/40'
                  : 'border-border'
            }`}
            draggable
            onDragEnd={onDragEnd}
            onDragOver={(event) => onDragOver(event, list.id, item.id)}
            onDragStart={() => onDragStart(list.id, item.id)}
            onDrop={() => onDrop(list.id, item.id)}
          >
            <div
              className={`mb-3 h-0.5 rounded-full bg-primary transition-all duration-150 ${
                dropIndicator?.listId === list.id &&
                dropIndicator.itemId === item.id &&
                dropIndicator.position === 'before' &&
                dragState?.itemId !== item.id
                  ? 'scale-x-100 opacity-100'
                  : 'scale-x-75 opacity-0'
              }`}
            />
            <div className="flex items-start gap-3">
              <button
                aria-label={t('home.dragHint')}
                className="mt-0.5 cursor-grab rounded-full border border-border px-2 py-1 text-xs text-muted-foreground active:cursor-grabbing"
                type="button"
              >
                ⋮⋮
              </button>
              <input
                checked={item.done}
                className="mt-1 h-4 w-4"
                onChange={() => onToggleItem(item)}
                type="checkbox"
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {item.text}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">{t('home.dragHint')}</p>
              </div>
              <div className="flex gap-1">
                <button
                  className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground transition hover:text-red-600"
                  onClick={() => onDeleteItem(item.id)}
                  type="button"
                >
                  ✕
                </button>
              </div>
            </div>
            <div
              className={`mt-3 h-0.5 rounded-full bg-primary transition-all duration-150 ${
                dropIndicator?.listId === list.id &&
                dropIndicator.itemId === item.id &&
                dropIndicator.position === 'after' &&
                dragState?.itemId !== item.id
                  ? 'scale-x-100 opacity-100'
                  : 'scale-x-75 opacity-0'
              }`}
            />
          </div>
        ))}

        {!list.items.length ? (
          <div className="rounded-[24px] border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            {t('home.noListItems')}
          </div>
        ) : null}
      </div>
    </div>
  );
}
