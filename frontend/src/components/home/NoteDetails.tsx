import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { Note } from '@/types';
import type { DisplayCategoryName, NoteAiUiState } from './types';

type NoteDetailsProps = {
  note: Note;
  noteAiState?: NoteAiUiState;
  onEdit: () => void;
  onDelete: () => void;
  onApplySuggestion: (actionLogId: string) => void;
  onHideSuggestion: () => void;
  displayCategoryName: DisplayCategoryName;
  formatDate: (value: string) => string;
};

export default function NoteDetails({
  note,
  noteAiState,
  onEdit,
  onDelete,
  onApplySuggestion,
  onHideSuggestion,
  displayCategoryName,
  formatDate,
}: NoteDetailsProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {t('home.noteView')}
          </p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-foreground">
            {note.title?.trim() || note.content.trim().split('\n')[0]?.slice(0, 52) || t('home.editorCreateTitle')}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
              {displayCategoryName(note.category)}
            </span>
            <span>{t('home.updatedAt', { value: formatDate(note.updatedAt) })}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={onEdit} size="sm" type="button">
            ✎ {t('home.edit')}
          </Button>
          <Button onClick={onDelete} size="sm" type="button" variant="outline">
            {t('common.delete')}
          </Button>
        </div>
      </div>

      {noteAiState?.phase === 'analyzing' ? (
        <div className="rounded-[22px] border border-primary/20 bg-primary/10 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            {t('home.aiAnalyzingTitle')}
          </p>
          <p className="mt-2 text-sm text-foreground">{t('home.aiAnalyzingDescription')}</p>
        </div>
      ) : null}

      {noteAiState?.phase === 'error' ? (
        <div className="rounded-[22px] border border-red-200 bg-red-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-700">
            {t('home.aiUnavailableTitle')}
          </p>
          <p className="mt-2 text-sm text-red-800">{noteAiState.message}</p>
        </div>
      ) : null}

      {noteAiState?.phase === 'suggested' ? (
        <div className="rounded-[22px] border border-primary/20 bg-primary/10 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            {t('home.aiSuggestionTitle')}
          </p>
          <p className="mt-2 text-sm text-foreground">
            {noteAiState.result.actionType === 'assign_category'
              ? t('home.aiSuggestionCategory', { category: noteAiState.result.categoryName })
              : t('home.aiSuggestionList', {
                  list: noteAiState.result.listName,
                  item: noteAiState.result.itemText,
                })}
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => onApplySuggestion(noteAiState.result.actionLogId)} size="sm" type="button">
              {t('common.apply')}
            </Button>
            <Button onClick={onHideSuggestion} size="sm" type="button" variant="outline">
              {t('common.hide')}
            </Button>
          </div>
        </div>
      ) : null}

      <article className="rounded-[24px] bg-muted/60 p-5">
        <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground/90">{note.content}</p>
      </article>
    </div>
  );
}
