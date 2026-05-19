import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const jwtService = {
    sign: jest.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AuthService(prisma as never, jwtService as never);
  });

  it('registers a user, normalizes email, and creates the system category', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'sofi@example.com',
    });
    jwtService.sign.mockReturnValue('jwt-token');
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password' as never);

    const result = await service.register({
      email: '  Sofi@Example.com ',
      password: 'password123',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'sofi@example.com' },
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'sofi@example.com',
        passwordHash: 'hashed-password',
        categories: {
          create: {
            name: 'Без категории',
            isSystem: true,
          },
        },
      },
    });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'sofi@example.com',
    });
    expect(result).toEqual({
      accessToken: 'jwt-token',
      user: {
        id: 'user-1',
        email: 'sofi@example.com',
      },
    });
  });

  it('throws when email is already registered', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.register({
        email: 'sofi@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in an existing user with normalized email', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'sofi@example.com',
      passwordHash: 'stored-hash',
    });
    jwtService.sign.mockReturnValue('jwt-token');
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    const result = await service.login({
      email: '  SOFI@example.com ',
      password: 'password123',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'sofi@example.com' },
    });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'sofi@example.com',
    });
    expect(result.accessToken).toBe('jwt-token');
  });

  it('throws when credentials are invalid', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'sofi@example.com',
      passwordHash: 'stored-hash',
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    await expect(
      service.login({
        email: 'sofi@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns the current user for me()', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'sofi@example.com',
    });

    await expect(service.me('user-1')).resolves.toEqual({
      id: 'user-1',
      email: 'sofi@example.com',
    });
  });
});
