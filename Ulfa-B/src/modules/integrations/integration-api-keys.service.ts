import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { IntegrationApiKey } from './entities/integration-api-key.entity';

@Injectable()
export class IntegrationApiKeysService {
  constructor(
    @InjectRepository(IntegrationApiKey)
    private readonly apiKeyRepository: Repository<IntegrationApiKey>,
  ) {}

  static hash(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  async create(merchantId: string, dto: CreateApiKeyDto) {
    const rawKey = `ulfa_live_${crypto.randomBytes(32).toString('base64url')}`;
    const entity = this.apiKeyRepository.create({
      merchantId,
      label: dto.label.trim(),
      keyHash: IntegrationApiKeysService.hash(rawKey),
      keyPrefix: rawKey.slice(0, 18),
    });
    const saved = await this.apiKeyRepository.save(entity);

    return {
      id: saved.id,
      label: saved.label,
      keyPrefix: saved.keyPrefix,
      apiKey: rawKey,
      createdAt: saved.createdAt,
      warning: 'Store this key securely. It will not be shown again.',
    };
  }

  findAll(merchantId: string) {
    return this.apiKeyRepository.find({
      where: { merchantId, revokedAt: IsNull() },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        createdAt: true,
        lastUsedAt: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(merchantId: string, id: string) {
    const key = await this.apiKeyRepository.findOne({
      where: { id, merchantId, revokedAt: IsNull() },
    });
    if (!key) {
      throw new NotFoundException('Active API key not found');
    }

    key.revokedAt = new Date();
    await this.apiKeyRepository.save(key);
    return { message: 'API key revoked successfully' };
  }
}

