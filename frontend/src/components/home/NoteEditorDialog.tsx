import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Category } from '@/types';
import type { DisplayCategoryName, EditorMode, NoteEditorState } from './types';

type NoteEditorDialogProps = {
  open: boolean;
  editorMode: EditorMode;
  saveStateLabel: string;
  editor: NoteEditorState;
  categories: Category[];
  onEditorChange: (value: NoteEditorState) => void;
  onClose: () => void;
  onCreateNote: () => void;
  displayCategoryName: DisplayCategoryName;
};

export default function NoteEditorDialog({
  open,
  editorMode,
  saveStateLabel,
  editor,
  categories,
  onEditorChange,
  onClose,
  onCreateNote,
  displayCategoryName,
}: NoteEditorDialogProps) {
  const { t } = useTranslation();

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[32px] border border-border/70 bg-card p-6 text-card-foreground shadow-2xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {editorMode === 'create' ? t('home.editorCreateTitle') : t('home.editorEditTitle')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {editorMode === 'create' ? t('home.editorCreateDescription') : t('home.editorEditDescription')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {editorMode === 'edit' ? (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {saveStateLabel}
              </span>
            ) : null}
            <Button onClick={onClose} size="sm" type="button" variant="outline">
              {t('common.close')}
            </Button>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">{t('home.titleLabel')}</span>
            <Input
              onChange={(event) => onEditorChange({ ...editor, title: event.target.value })}
              placeholder={t('home.titlePlaceholder')}
              value={editor.title}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">{t('home.categoryLabel')}</span>
            <Select
              onChange={(event) => onEditorChange({ ...editor, categoryId: event.target.value })}
              value={editor.categoryId}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {displayCategoryName(category)}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">{t('home.contentLabel')}</span>
            <Textarea
              className="min-h-[320px] resize-y bg-muted/50"
              onChange={(event) => onEditorChange({ ...editor, content: event.target.value })}
              placeholder={t('home.contentPlaceholder')}
              rows={14}
              value={editor.content}
            />
          </label>

          {editorMode === 'create' ? (
            <div className="flex justify-end">
              <Button disabled={!editor.content.trim() || saveStateLabel === t('home.saveState.saving')} onClick={onCreateNote} type="button">
                {saveStateLabel === t('home.saveState.saving') ? t('home.creatingNote') : t('home.createNote')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
