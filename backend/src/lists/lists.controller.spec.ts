import { ListsController } from './lists.controller';

describe('ListsController', () => {
  const listsService = {
    findAll: jest.fn(),
    create: jest.fn(),
    addItem: jest.fn(),
    remove: jest.fn(),
    reorderItems: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
  };

  let controller: ListsController;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new ListsController(listsService as never);
  });

  it('delegates findAll to ListsService', async () => {
    listsService.findAll.mockResolvedValue([]);

    await expect(controller.findAll({ user: { userId: 'user-1' } } as never)).resolves.toEqual([]);
    expect(listsService.findAll).toHaveBeenCalledWith('user-1');
  });

  it('delegates create to ListsService', async () => {
    listsService.create.mockResolvedValue({ id: 'list-1' });
    const dto = { name: 'Покупки' };

    await expect(controller.create({ user: { userId: 'user-1' } } as never, dto)).resolves.toEqual({
      id: 'list-1',
    });
    expect(listsService.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('delegates addItem to ListsService', async () => {
    listsService.addItem.mockResolvedValue({ id: 'item-1' });
    const dto = { text: 'milk' };

    await expect(controller.addItem({ user: { userId: 'user-1' } } as never, 'list-1', dto)).resolves.toEqual({
      id: 'item-1',
    });
    expect(listsService.addItem).toHaveBeenCalledWith('user-1', 'list-1', dto);
  });

  it('delegates remove to ListsService', async () => {
    listsService.remove.mockResolvedValue({ success: true });

    await expect(controller.remove({ user: { userId: 'user-1' } } as never, 'list-1')).resolves.toEqual({
      success: true,
    });
    expect(listsService.remove).toHaveBeenCalledWith('user-1', 'list-1');
  });

  it('delegates reorderItems to ListsService', async () => {
    listsService.reorderItems.mockResolvedValue([]);
    const dto = { itemIds: ['item-2', 'item-1'] };

    await expect(
      controller.reorderItems({ user: { userId: 'user-1' } } as never, 'list-1', dto),
    ).resolves.toEqual([]);
    expect(listsService.reorderItems).toHaveBeenCalledWith('user-1', 'list-1', dto);
  });

  it('delegates updateItem to ListsService', async () => {
    listsService.updateItem.mockResolvedValue({ id: 'item-1', done: true });
    const dto = { done: true };

    await expect(
      controller.updateItem({ user: { userId: 'user-1' } } as never, 'list-1', 'item-1', dto),
    ).resolves.toEqual({ id: 'item-1', done: true });
    expect(listsService.updateItem).toHaveBeenCalledWith('user-1', 'list-1', 'item-1', dto);
  });

  it('delegates removeItem to ListsService', async () => {
    listsService.removeItem.mockResolvedValue({ success: true });

    await expect(
      controller.removeItem({ user: { userId: 'user-1' } } as never, 'list-1', 'item-1'),
    ).resolves.toEqual({ success: true });
    expect(listsService.removeItem).toHaveBeenCalledWith('user-1', 'list-1', 'item-1');
  });
});
