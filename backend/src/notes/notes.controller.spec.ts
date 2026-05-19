import { NotesController } from './notes.controller';

describe('NotesController', () => {
  const notesService = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  let controller: NotesController;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new NotesController(notesService as never);
  });

  it('delegates findAll to NotesService', async () => {
    notesService.findAll.mockResolvedValue([]);

    await expect(controller.findAll({ user: { userId: 'user-1' } } as never)).resolves.toEqual([]);
    expect(notesService.findAll).toHaveBeenCalledWith('user-1');
  });

  it('delegates create to NotesService', async () => {
    notesService.create.mockResolvedValue({ id: 'note-1' });
    const dto = { title: 'Title', content: 'Content' };

    await expect(controller.create({ user: { userId: 'user-1' } } as never, dto)).resolves.toEqual({
      id: 'note-1',
    });
    expect(notesService.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('delegates update to NotesService', async () => {
    notesService.update.mockResolvedValue({ id: 'note-1', content: 'Updated' });
    const dto = { content: 'Updated' };

    await expect(
      controller.update({ user: { userId: 'user-1' } } as never, 'note-1', dto),
    ).resolves.toEqual({
      id: 'note-1',
      content: 'Updated',
    });
    expect(notesService.update).toHaveBeenCalledWith('user-1', 'note-1', dto);
  });

  it('delegates remove to NotesService', async () => {
    notesService.remove.mockResolvedValue({ success: true });

    await expect(controller.remove({ user: { userId: 'user-1' } } as never, 'note-1')).resolves.toEqual({
      success: true,
    });
    expect(notesService.remove).toHaveBeenCalledWith('user-1', 'note-1');
  });
});
