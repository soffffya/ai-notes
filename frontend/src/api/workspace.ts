import { apiFetch } from '@/api/client';
import type { Category, ListItem, Note, NotesList } from '@/types';

export type DeleteCategoryResponse = {
  success: boolean;
  reassignedToCategoryId: string;
};

export type DeleteListResponse = {
  success: boolean;
  restoredNotes: Note[];
};

export type DeleteListItemResponse = {
  success: boolean;
  restoredNote?: Note | null;
};

export type WorkspaceBootstrapPayload = {
  notes: Note[];
  categories: Category[];
  lists: NotesList[];
};

export function loadWorkspace() {
  return Promise.all([
    apiFetch<Note[]>('/notes'),
    apiFetch<Category[]>('/categories'),
    apiFetch<NotesList[]>('/lists'),
  ]).then(([notes, categories, lists]) => ({
    notes,
    categories,
    lists,
  }) satisfies WorkspaceBootstrapPayload);
}

export function createCategory(name: string) {
  return apiFetch<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function deleteCategory(categoryId: string) {
  return apiFetch<DeleteCategoryResponse>(`/categories/${categoryId}`, {
    method: 'DELETE',
  });
}

export function createList(name: string) {
  return apiFetch<NotesList>('/lists', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function deleteList(listId: string) {
  return apiFetch<DeleteListResponse>(`/lists/${listId}`, {
    method: 'DELETE',
  });
}

export function createListItem(listId: string, text: string) {
  return apiFetch<ListItem>(`/lists/${listId}/items`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export function deleteListItem(listId: string, itemId: string) {
  return apiFetch<DeleteListItemResponse>(`/lists/${listId}/items/${itemId}`, {
    method: 'DELETE',
  });
}

export function updateListItem(listId: string, itemId: string, payload: Partial<Pick<ListItem, 'done' | 'text'>>) {
  return apiFetch<ListItem>(`/lists/${listId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function reorderListItems(listId: string, itemIds: string[]) {
  return apiFetch<ListItem[]>(`/lists/${listId}/items/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ itemIds }),
  });
}

export function createNote(payload: Pick<Note, 'content'> & Partial<Pick<Note, 'title'>>) {
  return apiFetch<Note>('/notes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateNote(noteId: string, payload: Partial<Pick<Note, 'title' | 'content' | 'categoryId'>>) {
  return apiFetch<Note>(`/notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteNote(noteId: string) {
  return apiFetch<{ success: boolean }>(`/notes/${noteId}`, {
    method: 'DELETE',
  });
}
