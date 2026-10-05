import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export type SetupSession = { sub: string; tok: string; typ: 'setup' };
export type SetupRequest = Request & { setupSession?: SetupSession };

/** Reads a setup session token if present; never rejects. */
export function readSetupSession(
  jwt: JwtService,
  req: SetupRequest,
): SetupSession | null {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const payload = jwt.verify<SetupSession>(token);
    return payload.typ === 'setup' && payload.tok === req.params.token
      ? payload
      : null;
  } catch {
    return null;
  }
}

/**
 * Setup endpoints that read or change content need the short-lived token
 * issued after the buyer proves the answer (or recovery code).
 */
@Injectable()
export class SetupSessionGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<SetupRequest>();
    const session = readSetupSession(this.jwt, req);
    if (!session) throw new UnauthorizedException('SETUP_SESSION_REQUIRED');
    req.setupSession = session;
    return true;
  }
}
