import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UserRole, UserStatus } from '../../users/entities/user.entity';
import { IntegrationApiKey } from '../entities/integration-api-key.entity';
import { IntegrationApiKeysService } from '../integration-api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(IntegrationApiKey)
    private readonly apiKeyRepository: Repository<IntegrationApiKey>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers['x-api-key'];
    const rawKey = Array.isArray(header) ? header[0] : header;

    if (!rawKey || typeof rawKey !== 'string') {
      throw new UnauthorizedException('X-API-Key header is required');
    }

    const apiKey = await this.apiKeyRepository
      .createQueryBuilder('apiKey')
      .addSelect('apiKey.keyHash')
      .leftJoinAndSelect('apiKey.merchant', 'merchant')
      .where('apiKey.keyHash = :keyHash', {
        keyHash: IntegrationApiKeysService.hash(rawKey),
      })
      .andWhere('apiKey.revokedAt IS NULL')
      .getOne();

    if (
      !apiKey ||
      apiKey.merchant.role !== UserRole.MERCHANT ||
      apiKey.merchant.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    request.user = apiKey.merchant;
    request.integrationApiKey = apiKey;
    await this.apiKeyRepository.update(
      { id: apiKey.id, revokedAt: IsNull() },
      { lastUsedAt: new Date() },
    );
    return true;
  }
}
