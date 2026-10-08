import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { ALLOW_PENDING_PASSWORD_KEY } from './decorators/allow-pending-password.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

const userWithPassword = async (
  password: string,
  overrides: Partial<User> = {},
): Promise<User> =>
  Object.assign(new User(), {
    id: '7f8d9f0e-01f8-4b4f-b812-6240310f7de4',
    email: 'merchant@example.com',
    passwordHash: await bcrypt.hash(password, 4),
    role: UserRole.MERCHANT,
    status: UserStatus.ACTIVE,
    ...overrides,
  });

describe('AuthService.changePassword', () => {
  const build = (user: User) => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn(async (value: User) => value),
    };
    return {
      service: new AuthService(repository as any, {} as any),
      repository,
    };
  };

  it('saves the new password when the current one is right', async () => {
    const user = await userWithPassword('old-password');
    const { service, repository } = build(user);

    await expect(
      service.changePassword(user.id, {
        currentPassword: 'old-password',
        newPassword: 'new-password-1',
      }),
    ).resolves.toEqual({ message: 'Password changed' });

    expect(repository.save).toHaveBeenCalledWith(user);
    expect(user.passwordHash).toBe('new-password-1'); // hashed by the entity hook on save
  });

  it('rejects a wrong current password with 400, not 401', async () => {
    const user = await userWithPassword('old-password');
    const { service, repository } = build(user);

    const attempt = service.changePassword(user.id, {
      currentPassword: 'wrong',
      newPassword: 'new-password-1',
    });
    await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
    await expect(attempt).rejects.toMatchObject({
      response: { code: 'CURRENT_PASSWORD_INCORRECT' },
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password', async () => {
    const user = await userWithPassword('same-password');
    const { service } = build(user);

    await expect(
      service.changePassword(user.id, {
        currentPassword: 'same-password',
        newPassword: 'same-password',
      }),
    ).rejects.toMatchObject({ response: { code: 'PASSWORD_UNCHANGED' } });
  });
});

describe('UsersService.changeFirstLoginPassword', () => {
  const build = (user: User) => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn(async (value: User) => value),
    };
    return new UsersService(repository as any, {} as any);
  };

  it('sets the first password and activates the account', async () => {
    const user = await userWithPassword('Merchant123!', {
      status: UserStatus.PENDING_PASSWORD_SET,
    });
    const result = await build(user).changeFirstLoginPassword(
      user.id,
      'my-own-password',
    );
    expect(result.status).toBe(UserStatus.ACTIVE);
  });

  it('refuses once the password is set, so a session alone cannot change it', async () => {
    const user = await userWithPassword('current-password');
    await expect(
      build(user).changeFirstLoginPassword(user.id, 'attacker-password'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires at least 8 characters', async () => {
    const user = await userWithPassword('Merchant123!', {
      status: UserStatus.PENDING_PASSWORD_SET,
    });
    await expect(
      build(user).changeFirstLoginPassword(user.id, 'short'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('JwtAuthGuard', () => {
  const context = (allowPending: boolean) => {
    const handler = () => undefined;
    if (allowPending)
      Reflect.defineMetadata(ALLOW_PENDING_PASSWORD_KEY, true, handler);
    return {
      getHandler: () => handler,
      getClass: () => class {},
    } as unknown as ExecutionContext;
  };
  const guard = new JwtAuthGuard(new Reflector());
  const user = (status: UserStatus) => Object.assign(new User(), { status });

  it('lets active accounts through', () => {
    const active = user(UserStatus.ACTIVE);
    expect(guard.handleRequest(null, active, null, context(false))).toBe(
      active,
    );
  });

  it('keeps accounts that must set a password away from everything else', () => {
    expect(() =>
      guard.handleRequest(
        null,
        user(UserStatus.PENDING_PASSWORD_SET),
        null,
        context(false),
      ),
    ).toThrow(ForbiddenException);
  });

  it('lets them reach the routes that set the password', () => {
    const pending = user(UserStatus.PENDING_PASSWORD_SET);
    expect(guard.handleRequest(null, pending, null, context(true))).toBe(
      pending,
    );
  });
});
