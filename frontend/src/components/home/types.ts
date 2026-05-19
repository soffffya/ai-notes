import type { AiAnalyzeResult, Category } from '@/types';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export type EditorMode = 'create' | 'edit';
export type SidebarMode = 'notes' | 'lists';
export type DragState = { listId: string; itemId: string } | null;
export type DropIndicator = { listId: string; itemId: string; position: 'before' | 'after' } | null;
export type NoteAiUiState =
  | { phase: 'analyzing' }
  | { phase: 'suggested'; result: Extract<AiAnalyzeResult, { status: 'suggested' }> }
  | { phase: 'error'; message: string }
  | { phase: 'idle' };

export type NoteEditorState = {
  title: string;
  content: string;
  categoryId: string;
};

export type DisplayCategoryName = (category?: Category | null) => string;
