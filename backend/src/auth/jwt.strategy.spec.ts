import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('maps JWT payload to authenticated user shape', () => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;

    const strategy = new JwtStrategy(configService);

    expect(strategy.validate({ sub: 'user-1', email: 'sofi@example.com' })).toEqual({
      userId: 'user-1',
      email: 'sofi@example.com',
    });
  });
});
