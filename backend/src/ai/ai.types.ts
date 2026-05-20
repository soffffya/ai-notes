import type { AiActionLog } from '@prisma/client';

export type AiModelDecision = {
  action: 'assign_category' | 'add_to_list' | 'none';
  confidence: number;
  categoryId: string | null;
  listId: string | null;
  itemText: string | null;
  reason: string;
};

export type AiAnalyzeResult =
  | { status: 'missing-note' }
  | { status: 'skipped'; reason: string }
  | { status: 'low_confidence'; confidence: number; reason: string }
  | {
      status: 'auto_applied';
      actionLogId: string;
      undoExpiresAt: string;
      actionType: 'assign_category' | 'add_to_list';
      confidence: number;
      reason: string;
      note: unknown;
      categoryName?: string;
      listId?: string;
      listName?: string;
      listItem?: unknown;
    }
  | {
      status: 'suggested';
      actionLogId: string;
      actionType: 'assign_category' | 'add_to_list';
      confidence: number;
      reason: string;
      categoryId?: string;
      categoryName?: string;
      listId?: string;
      listName?: string;
      itemText?: string;
    };

export type AiUndoResult =
  | {
      status: 'undone';
      actionType: 'assign_category' | 'add_to_list';
      note?: unknown;
      listId?: string;
      removedListItemId?: string;
      undoneAt: string;
    }
  | {
      status: 'expired';
      reason: string;
    };

export type ResolveDecisionOptions = {
  sourceActionLog?: AiActionLog;
  forceApply?: boolean;
};

export type AiNoteContext = {
  id: string;
  userId?: string;
  title: string | null;
  content: string;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
    isSystem: boolean;
  };
};

export type AiCategoryOption = {
  id: string;
  name: string;
  isSystem: boolean;
};

export type AiListOption = {
  id: string;
  name: string;
  items: Array<{ id: string; text: string; noteId: string | null }>;
};
