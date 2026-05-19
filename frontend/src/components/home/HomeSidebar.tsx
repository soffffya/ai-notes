import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Category, Note, NotesList } from '@/types';
import type { DisplayCategoryName, SidebarMode } from './types';

type HomeSidebarProps = {
  email: string;
  sidebarMode: SidebarMode;
  onSidebarModeChange: (mode: SidebarMode) => void;
  onOpenSettings: () => void;
  onOpenCreateEditor: () => void;
  categories: Category[];
  notes: Note[];
  filteredNotes: Note[];
  lists: NotesList[];
  selectedCategoryFilter: string;
  selectedNoteId: string | null;
  selectedListId: string | null;
  newCategoryName: string;
  isCreatingCategory: boolean;
  onNewCategoryNameChange: (value: string) => void;
  onCreateCategory: (event: FormEvent<HTMLFormElement>) => void;
  onSelectCategoryFilter: (value: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  displayCategoryName: DisplayCategoryName;
  newListName: string;
  isCreatingList: boolean;
  onNewListNameChange: (value: string) => void;
  onCreateList: (event: FormEvent<HTMLFormElement>) => void;
  onSelectNote: (noteId: string) => void;
  onSelectList: (listId: string) => void;
  formatDate: (value: string) => string;
};

export default function HomeSidebar({
  email,
  sidebarMode,
  onSidebarModeChange,
  onOpenSettings,
  onOpenCreateEditor,
  categories,
  notes,
  filteredNotes,
  lists,
  selectedCategoryFilter,
  selectedNoteId,
  selectedListId,
  newCategoryName,
  isCreatingCategory,
  onNewCategoryNameChange,
  onCreateCategory,
  onSelectCategoryFilter,
  onDeleteCategory,
  displayCategoryName,
  newListName,
  isCreatingList,
  onNewListNameChange,
  onCreateList,
  onSelectNote,
  onSelectList,
  formatDate,
}: HomeSidebarProps) {
  const { t } = useTranslation();

  return (
    <Card className="border-border/80 bg-card/95 shadow-soft">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              AI Notes
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-wrap sm:justify-end">
            <Button className="w-full sm:w-auto" onClick={onOpenSettings} size="sm" type="button" variant="outline">
              {t('common.settings')}
            </Button>
            <Button className="w-full sm:w-auto" onClick={onOpenCreateEditor} size="sm" type="button">
              ✎ {t('common.new')}
            </Button>
          </div>
        </div>

        <Tabs className="mt-5" onValueChange={(value) => onSidebarModeChange(value as SidebarMode)} value={sidebarMode}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="notes">{t('common.notes')}</TabsTrigger>
            <TabsTrigger value="lists">{t('common.lists')}</TabsTrigger>
          </TabsList>
        </Tabs>

        <ScrollArea className="mt-5 h-[calc(100vh-18rem)] px-1 pr-3">
          {sidebarMode === 'notes' ? (
            <section className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {t('common.categories')}
                </p>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                  {categories.length}
                </span>
              </div>

              <form className="mb-4 flex gap-2" onSubmit={onCreateCategory}>
                <Input
                  className="min-w-0 flex-1 focus-visible:border-ring focus-visible:ring-0 focus-visible:ring-offset-0"
                  onChange={(event) => onNewCategoryNameChange(event.target.value)}
                  placeholder={t('home.newCategoryPlaceholder')}
                  value={newCategoryName}
                />
                <Button disabled={isCreatingCategory} type="submit" variant="outline">
                  {isCreatingCategory ? '...' : '+'}
                </Button>
              </form>

              <div className="space-y-2">
                <button
                  className={`w-full rounded-[18px] border px-4 py-3 text-left transition ${
                    selectedCategoryFilter === 'all'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background/70 text-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                  onClick={() => onSelectCategoryFilter('all')}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{t('home.allNotes')}</span>
                    <span className="text-xs opacity-75">{notes.length}</span>
                  </div>
                </button>

                {categories.map((category) => {
                  const notesCount = notes.filter((note) => note.categoryId === category.id).length;

                  return (
                    <div
                      key={category.id}
                      className={`rounded-[18px] border px-4 py-3 ${
                        selectedCategoryFilter === category.id
                          ? 'border-primary/30 bg-accent text-accent-foreground'
                          : 'border-border bg-background/70'
                      }`}
                    >
                      <button className="w-full text-left" onClick={() => onSelectCategoryFilter(category.id)} type="button">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {displayCategoryName(category)}
                          </span>
                          <span className="text-xs text-muted-foreground">{notesCount}</span>
                        </div>
                      </button>
                      {!category.isSystem ? (
                        <div className="mt-2 flex justify-end">
                          <button
                            className="text-xs font-medium text-muted-foreground transition hover:text-red-600"
                            onClick={() => onDeleteCategory(category.id)}
                            type="button"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {sidebarMode === 'notes' ? (
            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {t('common.notes')}
                </p>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                  {filteredNotes.length}
                </span>
              </div>

              <div className="space-y-2">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`rounded-[18px] border px-4 py-3 ${
                      selectedNoteId === note.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background/70'
                    }`}
                  >
                    <button className="w-full text-left" onClick={() => onSelectNote(note.id)} type="button">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {note.title?.trim() || note.content.trim().split('\n')[0]?.slice(0, 52) || t('home.editorCreateTitle')}
                          </p>
                          <p
                            className={`mt-1 line-clamp-2 text-xs ${
                              selectedNoteId === note.id ? 'text-primary-foreground/80' : 'text-muted-foreground'
                            }`}
                          >
                            {note.content}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-[11px] ${
                            selectedNoteId === note.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}
                        >
                          {formatDate(note.updatedAt)}
                        </span>
                      </div>
                    </button>
                  </div>
                ))}

                {!filteredNotes.length ? (
                  <div className="rounded-[18px] border border-dashed border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
                    {t('home.noNotesInCategory')}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {sidebarMode === 'lists' ? (
            <section className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {t('common.lists')}
                </p>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                  {lists.length}
                </span>
              </div>

              <form className="mb-4 flex gap-2" onSubmit={onCreateList}>
                <Input
                  className="min-w-0 flex-1 focus-visible:border-ring focus-visible:ring-0 focus-visible:ring-offset-0"
                  onChange={(event) => onNewListNameChange(event.target.value)}
                  placeholder={t('home.newListPlaceholder')}
                  value={newListName}
                />
                <Button disabled={isCreatingList} type="submit" variant="outline">
                  {isCreatingList ? '...' : '+'}
                </Button>
              </form>

              <div className="space-y-2">
                {lists.map((list) => (
                  <div
                    key={list.id}
                    className={`rounded-[18px] border px-4 py-3 ${
                      selectedListId === list.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background/70'
                    }`}
                  >
                    <button className="w-full text-left" onClick={() => onSelectList(list.id)} type="button">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{list.name}</p>
                          <p
                            className={`mt-1 text-xs ${
                              selectedListId === list.id ? 'text-primary-foreground/80' : 'text-muted-foreground'
                            }`}
                          >
                            {t('home.listItemsCount', { count: list.items.length })}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                ))}

                {!lists.length ? (
                  <div className="rounded-[18px] border border-dashed border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
                    {t('home.noLists')}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </ScrollArea>

        <Separator className="my-6" />

        <div className="text-xs text-muted-foreground">{email}</div>
      </CardContent>
    </Card>
  );
}
