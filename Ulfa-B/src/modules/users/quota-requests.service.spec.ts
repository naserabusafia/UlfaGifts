import { BadRequestException, ConflictException } from '@nestjs/common';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { QuotaLog } from './entities/quota-log.entity';
import {
  QuotaRequest,
  QuotaRequestStatus,
} from './entities/quota-request.entity';
import { QuotaRequestsService } from './quota-requests.service';

const ADMIN_ID = 'a0000000-0000-4000-8000-000000000001';

const merchantFixture = (overrides: Partial<User> = {}): User =>
  Object.assign(new User(), {
    id: 'm0000000-0000-4000-8000-000000000001',
    email: 'merchant@example.com',
    role: UserRole.MERCHANT,
    status: UserStatus.ACTIVE,
    isUnlimitedQuota: false,
    totalQuota: 10,
    usedLinks: 4,
    ...overrides,
  });

const requestFixture = (overrides: Partial<QuotaRequest> = {}) =>
  Object.assign(new QuotaRequest(), {
    id: 'r0000000-0000-4000-8000-000000000001',
    merchantId: 'm0000000-0000-4000-8000-000000000001',
    requestedAmount: 50,
    status: QuotaRequestStatus.PENDING,
    ...overrides,
  });

const buildService = (state: {
  merchant: User;
  request?: QuotaRequest | null;
  pending?: QuotaRequest | null;
}) => {
  const saved: Array<{ entity: unknown; data: any }> = [];
  const manager = {
    findOne: jest.fn(async (entity: unknown, options: any) => {
      if (entity === User) return state.merchant;
      if (entity === QuotaRequest) {
        // The pending-request lookup filters by status; the others by id.
        return options.where.status ? (state.pending ?? null) : state.request;
      }
      return null;
    }),
    create: jest.fn((entity: unknown, data: Record<string, unknown>) =>
      entity === QuotaRequest
        ? Object.assign(new QuotaRequest(), data)
        : { ...data },
    ),
    save: jest.fn(async (entity: unknown, data: any) => {
      saved.push({ entity, data });
      return data;
    }),
  };
  const dataSource = {
    transaction: jest.fn((callback: (m: any) => unknown) => callback(manager)),
  };
  const service = new QuotaRequestsService({} as any, dataSource as any);
  return { service, saved };
};

describe('QuotaRequestsService', () => {
  it('lets a limited merchant ask for more quota with a reason', async () => {
    const { service } = buildService({ merchant: merchantFixture() });

    const result = await service.create(
      'm0000000-0000-4000-8000-000000000001',
      {
        amount: 25,
        reason: '  Eid season  ',
      },
    );

    expect(result.status).toBe(QuotaRequestStatus.PENDING);
    expect(result.requestedAmount).toBe(25);
    expect(result.merchantReason).toBe('Eid season');
  });

  it('refuses a merchant with unlimited quota', async () => {
    const { service } = buildService({
      merchant: merchantFixture({ isUnlimitedQuota: true }),
    });

    await expect(
      service.create('m0000000-0000-4000-8000-000000000001', { amount: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows only one pending request at a time', async () => {
    const { service } = buildService({
      merchant: merchantFixture(),
      pending: requestFixture(),
    });

    await expect(
      service.create('m0000000-0000-4000-8000-000000000001', { amount: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('approves the requested amount and logs it', async () => {
    const merchant = merchantFixture();
    const request = requestFixture();
    const { service, saved } = buildService({ merchant, request });

    const result = await service.approve(request.id, ADMIN_ID, {});

    expect(merchant.totalQuota).toBe(60);
    expect(result.status).toBe(QuotaRequestStatus.APPROVED);
    expect(result.approvedAmount).toBe(50);
    expect(result.reviewedById).toBe(ADMIN_ID);
    const log = saved.find((entry) => entry.entity === QuotaLog)?.data;
    expect(log).toMatchObject({ amount: 50, adminId: ADMIN_ID });
  });

  it('approves a different amount than requested, with a reason', async () => {
    const merchant = merchantFixture();
    const request = requestFixture();
    const { service, saved } = buildService({ merchant, request });

    const result = await service.approve(request.id, ADMIN_ID, {
      amount: 20,
      reason: 'Partial for now',
    });

    expect(merchant.totalQuota).toBe(30);
    expect(result.approvedAmount).toBe(20);
    expect(result.adminReason).toBe('Partial for now');
    const log = saved.find((entry) => entry.entity === QuotaLog)?.data;
    expect(log.notes).toContain('20 of 50');
    expect(log.notes).toContain('Partial for now');
  });

  it('rejects without touching the quota', async () => {
    const merchant = merchantFixture();
    const request = requestFixture();
    const { service, saved } = buildService({ merchant, request });

    const result = await service.reject(request.id, ADMIN_ID, {
      reason: 'Unpaid invoice',
    });

    expect(result.status).toBe(QuotaRequestStatus.REJECTED);
    expect(result.adminReason).toBe('Unpaid invoice');
    expect(merchant.totalQuota).toBe(10);
    expect(saved.some((entry) => entry.entity === QuotaLog)).toBe(false);
  });

  it('cannot answer a request twice', async () => {
    const request = requestFixture({ status: QuotaRequestStatus.APPROVED });
    const { service } = buildService({ merchant: merchantFixture(), request });

    await expect(
      service.approve(request.id, ADMIN_ID, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.reject(request.id, ADMIN_ID, {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
