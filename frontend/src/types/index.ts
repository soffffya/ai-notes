export type Category = {
  id: string;
  name: string;
  isSystem: boolean;
};

export type Note = {
  id: string;
  title?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  categoryId: string;
  category: Category;
};

export type ListItem = {
  id: string;
  text: string;
  done: boolean;
  position: number;
  noteId?: string | null;
};

export type NotesList = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: ListItem[];
};

export type AiAnalyzeResult =
  | {
      status: 'missing-note';
    }
  | {
      status: 'skipped';
      reason: string;
    }
  | {
      status: 'low_confidence';
      confidence: number;
      reason: string;
    }
  | {
      status: 'auto_applied';
      actionLogId: string;
      undoExpiresAt: string;
      actionType: 'assign_category' | 'add_to_list';
      confidence: number;
      reason: string;
      note: Note;
      categoryName?: string;
      listId?: string;
      listName?: string;
      listItem?: ListItem;
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
      note?: Note;
      listId?: string;
      removedListItemId?: string;
      undoneAt: string;
    }
  | {
      status: 'expired';
      reason: string;
    };
