import { CategoriesController } from './categories.controller';

describe('CategoriesController', () => {
  const categoriesService = {
    findAll: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };

  let controller: CategoriesController;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new CategoriesController(categoriesService as never);
  });

  it('delegates findAll to CategoriesService', async () => {
    categoriesService.findAll.mockResolvedValue([]);

    await expect(controller.findAll({ user: { userId: 'user-1' } } as never)).resolves.toEqual([]);
    expect(categoriesService.findAll).toHaveBeenCalledWith('user-1');
  });

  it('delegates create to CategoriesService', async () => {
    categoriesService.create.mockResolvedValue({ id: 'category-1', name: 'Работа' });
    const dto = { name: 'Работа' };

    await expect(controller.create({ user: { userId: 'user-1' } } as never, dto)).resolves.toEqual({
      id: 'category-1',
      name: 'Работа',
    });
    expect(categoriesService.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('delegates remove to CategoriesService', async () => {
    categoriesService.remove.mockResolvedValue({ success: true });

    await expect(controller.remove({ user: { userId: 'user-1' } } as never, 'category-1')).resolves.toEqual({
      success: true,
    });
    expect(categoriesService.remove).toHaveBeenCalledWith('user-1', 'category-1');
  });
});
