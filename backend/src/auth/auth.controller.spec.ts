import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    me: jest.fn(),
  };

  let controller: AuthController;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new AuthController(authService as never);
  });

  it('delegates register to AuthService', async () => {
    authService.register.mockResolvedValue({ accessToken: 'token' });
    const dto = { email: 'sofi@example.com', password: 'password123' };

    await expect(controller.register(dto)).resolves.toEqual({ accessToken: 'token' });
    expect(authService.register).toHaveBeenCalledWith(dto);
  });

  it('delegates login to AuthService', async () => {
    authService.login.mockResolvedValue({ accessToken: 'token' });
    const dto = { email: 'sofi@example.com', password: 'password123' };

    await expect(controller.login(dto)).resolves.toEqual({ accessToken: 'token' });
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('delegates me to AuthService using req.user.userId', async () => {
    authService.me.mockResolvedValue({ id: 'user-1', email: 'sofi@example.com' });

    await expect(
      controller.me({
        user: {
          userId: 'user-1',
          email: 'sofi@example.com',
        },
      } as never),
    ).resolves.toEqual({
      id: 'user-1',
      email: 'sofi@example.com',
    });
    expect(authService.me).toHaveBeenCalledWith('user-1');
  });
});
