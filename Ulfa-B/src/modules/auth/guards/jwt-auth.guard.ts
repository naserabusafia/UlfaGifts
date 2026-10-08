import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { User, UserStatus } from '../../users/entities/user.entity';
import { ALLOW_PENDING_PASSWORD_KEY } from '../decorators/allow-pending-password.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  handleRequest<TUser = User>(
    err: unknown,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err) throw err;
    if (!user) throw new UnauthorizedException();

    const pending =
      (user as unknown as User).status === UserStatus.PENDING_PASSWORD_SET;
    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_PASSWORD_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (pending && !allowed) {
      throw new ForbiddenException({
        message: 'PASSWORD_CHANGE_REQUIRED',
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
    }
    return user;
  }
}
