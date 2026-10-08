import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { QuotaLog } from './entities/quota-log.entity';
import {
  QuotaRequest,
  QuotaRequestStatus,
} from './entities/quota-request.entity';
import {
  ApproveQuotaRequestDto,
  CreateQuotaRequestDto,
  QuotaRequestsQueryDto,
  RejectQuotaRequestDto,
} from './dto/quota-request.dto';

const MERCHANT_FIELDS = [
  'id',
  'email',
  'companyName',
  'isUnlimitedQuota',
  'totalQuota',
  'usedLinks',
] as const;

const cleanReason = (reason?: string) => reason?.trim() || null;

@Injectable()
export class QuotaRequestsService {
  constructor(
    @InjectRepository(QuotaRequest)
    private readonly requestRepository: Repository<QuotaRequest>,
    private readonly dataSource: DataSource,
  ) {}

  /** Strips the merchant and reviewer down to what the screens show. */
  private toView(request: QuotaRequest) {
    const pick = (user?: User | null) =>
      user
        ? Object.fromEntries(
            MERCHANT_FIELDS.map((field) => [field, user[field]]),
          )
        : null;
    return {
      ...request,
      merchant: pick(request.merchant),
      reviewedBy: request.reviewedBy
        ? {
            id: request.reviewedBy.id,
            email: request.reviewedBy.email,
            companyName: request.reviewedBy.companyName,
          }
        : null,
    };
  }

  async create(merchantId: string, dto: CreateQuotaRequestDto) {
    return this.dataSource.transaction(async (manager) => {
      // Locking the merchant keeps two quick submits from both getting through.
      const merchant = await manager.findOne(User, {
        where: { id: merchantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!merchant || merchant.role !== UserRole.MERCHANT) {
        throw new ForbiddenException('A valid merchant account is required');
      }
      if (merchant.isUnlimitedQuota) {
        throw new BadRequestException({
          message: 'QUOTA_UNLIMITED',
          code: 'QUOTA_UNLIMITED',
        });
      }

      const pending = await manager.findOne(QuotaRequest, {
        where: { merchantId, status: QuotaRequestStatus.PENDING },
      });
      if (pending) {
        throw new ConflictException({
          message: 'QUOTA_REQUEST_PENDING',
          code: 'QUOTA_REQUEST_PENDING',
        });
      }

      const saved = await manager.save(
        QuotaRequest,
        manager.create(QuotaRequest, {
          merchantId,
          requestedAmount: dto.amount,
          merchantReason: cleanReason(dto.reason),
          status: QuotaRequestStatus.PENDING,
        }),
      );
      return this.toView(saved);
    });
  }

  async findForMerchant(merchantId: string) {
    const requests = await this.requestRepository.find({
      where: { merchantId },
      relations: { reviewedBy: true },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return requests.map((request) => this.toView(request));
  }

  async cancelByMerchant(merchantId: string, id: string) {
    return this.dataSource.transaction(async (manager) => {
      const request = await this.lockRequest(manager, id, merchantId);
      this.assertPending(request);
      request.status = QuotaRequestStatus.CANCELLED;
      return this.toView(await manager.save(QuotaRequest, request));
    });
  }

  async findAll(query: QuotaRequestsQueryDto) {
    const { page = 1, limit = 20, status, merchantId } = query;
    const builder = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.merchant', 'merchant')
      .leftJoinAndSelect('request.reviewedBy', 'reviewedBy');
    if (status) builder.andWhere('request.status = :status', { status });
    if (merchantId) {
      builder.andWhere('request.merchantId = :merchantId', { merchantId });
    }
    // Pending requests oldest first (longest waiting on top); history newest first.
    builder
      .orderBy(
        'request.createdAt',
        status === QuotaRequestStatus.PENDING ? 'ASC' : 'DESC',
      )
      .skip((page - 1) * limit)
      .take(limit);

    const [[items, total], pending] = await Promise.all([
      builder.getManyAndCount(),
      this.requestRepository.countBy({ status: QuotaRequestStatus.PENDING }),
    ]);

    return {
      items: items.map((request) => this.toView(request)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      summary: { pending },
    };
  }

  async countPending() {
    return {
      pending: await this.requestRepository.countBy({
        status: QuotaRequestStatus.PENDING,
      }),
    };
  }

  /**
   * Grants the request: the amount asked for, or the one the admin set, is
   * added to the merchant's quota and written to the quota log.
   */
  async approve(id: string, adminId: string, dto: ApproveQuotaRequestDto) {
    return this.dataSource.transaction(async (manager) => {
      const request = await this.lockRequest(manager, id);
      this.assertPending(request);

      const merchant = await manager.findOne(User, {
        where: { id: request.merchantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!merchant) {
        throw new NotFoundException('Merchant not found');
      }

      const amount = dto.amount ?? request.requestedAmount;
      const reason = cleanReason(dto.reason);

      merchant.totalQuota = (merchant.totalQuota || 0) + amount;
      await manager.save(User, merchant);
      await manager.save(
        QuotaLog,
        manager.create(QuotaLog, {
          merchantId: merchant.id,
          adminId,
          amount,
          notes: [
            amount === request.requestedAmount
              ? `Quota request approved (${amount})`
              : `Quota request approved: ${amount} of ${request.requestedAmount} requested`,
            reason,
          ]
            .filter(Boolean)
            .join(' — '),
        }),
      );

      request.status = QuotaRequestStatus.APPROVED;
      request.approvedAmount = amount;
      request.adminReason = reason;
      request.reviewedById = adminId;
      request.reviewedAt = new Date();
      await manager.save(QuotaRequest, request);
      request.merchant = merchant;
      return this.toView(request);
    });
  }

  async reject(id: string, adminId: string, dto: RejectQuotaRequestDto) {
    return this.dataSource.transaction(async (manager) => {
      const request = await this.lockRequest(manager, id);
      this.assertPending(request);
      request.status = QuotaRequestStatus.REJECTED;
      request.approvedAmount = null;
      request.adminReason = cleanReason(dto.reason);
      request.reviewedById = adminId;
      request.reviewedAt = new Date();
      await manager.save(QuotaRequest, request);
      request.merchant =
        (await manager.findOne(User, { where: { id: request.merchantId } })) ??
        undefined;
      return this.toView(request);
    });
  }

  private async lockRequest(
    manager: EntityManager,
    id: string,
    merchantId?: string,
  ) {
    const request = await manager.findOne(QuotaRequest, {
      where: merchantId ? { id, merchantId } : { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!request) {
      throw new NotFoundException(`Quota request "${id}" not found`);
    }
    return request;
  }

  private assertPending(request: QuotaRequest) {
    if (request.status !== QuotaRequestStatus.PENDING) {
      throw new ConflictException({
        message: 'QUOTA_REQUEST_ALREADY_CLOSED',
        code: 'QUOTA_REQUEST_ALREADY_CLOSED',
        status: request.status,
      });
    }
  }
}
