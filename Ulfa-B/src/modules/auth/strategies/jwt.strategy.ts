import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../users/entities/user.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('jwt.secret') ||
        'super_secret_jwt_key_ulfa_2026_change_in_production',
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const { sub: id } = payload;
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new UnauthorizedException('Token user no longer exists');
    }

    // Accounts that still have to set their password get through here;
    // JwtAuthGuard limits them to the routes that let them do it.
    if (
      user.status !== UserStatus.ACTIVE &&
      user.status !== UserStatus.PENDING_PASSWORD_SET
    ) {
      throw new UnauthorizedException('ACCOUNT_NOT_ACTIVE');
    }

    delete (user as any).passwordHash;
    return user;
  }
}
