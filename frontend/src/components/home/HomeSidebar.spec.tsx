import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomeSidebar from './HomeSidebar';

describe('HomeSidebar', () => {
  const baseProps = {
    email: 'sofi@example.com',
    sidebarMode: 'notes' as const,
    onSidebarModeChange: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenCreateEditor: vi.fn(),
    categories: [
      { id: 'category-1', name: 'Без категории', isSystem: true },
      { id: 'category-2', name: 'Работа', isSystem: false },
    ],
    notes: [
      {
        id: 'note-1',
        title: 'Первая заметка',
        content: 'Контент',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        categoryId: 'category-2',
        category: { id: 'category-2', name: 'Работа', isSystem: false },
      },
    ],
    filteredNotes: [
      {
        id: 'note-1',
        title: 'Первая заметка',
        content: 'Контент',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        categoryId: 'category-2',
        category: { id: 'category-2', name: 'Работа', isSystem: false },
      },
    ],
    lists: [
      {
        id: 'list-1',
        name: 'Покупки',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [],
      },
    ],
    selectedCategoryFilter: 'all',
    selectedNoteId: null,
    selectedListId: null,
    newCategoryName: '',
    isCreatingCategory: false,
    onNewCategoryNameChange: vi.fn(),
    onCreateCategory: vi.fn(),
    onSelectCategoryFilter: vi.fn(),
    onDeleteCategory: vi.fn(),
    displayCategoryName: (category?: { name: string } | null) => category?.name ?? 'Без категории',
    newListName: '',
    isCreatingList: false,
    onNewListNameChange: vi.fn(),
    onCreateList: vi.fn(),
    onSelectNote: vi.fn(),
    onSelectList: vi.fn(),
    formatDate: () => '19.05.2026',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls category and note selection callbacks in notes mode', async () => {
    const user = userEvent.setup();

    render(<HomeSidebar {...baseProps} />);

    await user.click(screen.getByRole('button', { name: /All notes/i }));
    await user.click(screen.getByRole('button', { name: /Первая заметка/i }));

    expect(baseProps.onSelectCategoryFilter).toHaveBeenCalledWith('all');
    expect(baseProps.onSelectNote).toHaveBeenCalledWith('note-1');
  });

  it('switches to lists mode and allows selecting a list', async () => {
    const user = userEvent.setup();

    render(<HomeSidebar {...baseProps} />);

    await user.click(screen.getByRole('tab', { name: 'Lists' }));

    expect(baseProps.onSidebarModeChange).toHaveBeenCalledWith('lists');
  });
});
