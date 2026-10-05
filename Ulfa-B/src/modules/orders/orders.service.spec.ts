import { ForbiddenException } from '@nestjs/common';
import { Order, OrderSource, OrderStatus } from './entities/order.entity';
import { NfcItem } from '../nfc-items/entities/nfc-item.entity';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { OrdersService } from './orders.service';

const merchantFixture = (overrides: Partial<User> = {}): User =>
  Object.assign(new User(), {
    id: '7f8d9f0e-01f8-4b4f-b812-6240310f7de4',
    email: 'merchant@example.com',
    passwordHash: '$2b$hashed',
    role: UserRole.MERCHANT,
    status: UserStatus.ACTIVE,
    isUnlimitedQuota: false,
    totalQuota: 5,
    usedLinks: 1,
    ...overrides,
  });

const buildService = (merchant: User) => {
  const savedEntities: unknown[] = [];
  const manager = {
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === User) return merchant;
      return null;
    }),
    create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
      if (entity === Order) return Object.assign(new Order(), data);
      if (entity === NfcItem) return Object.assign(new NfcItem(), data);
      return data;
    }),
    save: jest.fn(async (entity: unknown, data: any) => {
      savedEntities.push(data);
      if (entity === Order) {
        data.id = '3d76fa82-17f0-4fa7-b499-d784cc2a2ab5';
        data.createdAt = new Date('2026-08-12T10:00:00.000Z');
        data.status = data.status || OrderStatus.PENDING;
      }
      if (entity === NfcItem) {
        data.forEach((item: NfcItem, index: number) => {
          item.id = `item-${index + 1}`;
        });
      }
      return data;
    }),
  };
  const dataSource = {
    transaction: jest.fn((callback: (entityManager: any) => unknown) =>
      callback(manager),
    ),
  };
  const configService = {
    get: jest.fn((_key: string, fallback: string) => fallback),
  };
  const service = new OrdersService(
    {} as any,
    {} as any,
    dataSource as any,
    configService as any,
    {} as any,
  );
  return { service, manager, savedEntities };
};

describe('OrdersService.createForMerchant', () => {
  it('creates all NFC items and consumes exactly one quota unit per item', async () => {
    const merchant = merchantFixture();
    const { service } = buildService(merchant);

    const result = await service.createForMerchant(merchant.id, {
      customerName: 'Jane Doe',
      customerPhone: '+970 59 123 4567',
      items: [{ productName: 'Ring' }, { productName: 'Necklace' }],
    });

    expect(result.items).toHaveLength(2);
    expect(result.customerPhone).toBe('+970591234567');
    expect(result.source).toBe(OrderSource.MERCHANT_PORTAL);
    expect(result.quota).toEqual({
      unlimited: false,
      used: 3,
      total: 5,
      remaining: 2,
    });
    expect(merchant.usedLinks).toBe(3);
  });

  it('rejects the entire order before writing when available quota is too low', async () => {
    const merchant = merchantFixture({ totalQuota: 2, usedLinks: 1 });
    const { service, manager } = buildService(merchant);

    await expect(
      service.createForMerchant(merchant.id, {
        customerName: 'Jane Doe',
        customerPhone: '+970591234567',
        items: [{ productName: 'Ring' }, { productName: 'Necklace' }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(manager.save).not.toHaveBeenCalled();
    expect(merchant.usedLinks).toBe(1);
  });

  it('allows unlimited merchants regardless of their numeric quota', async () => {
    const merchant = merchantFixture({
      isUnlimitedQuota: true,
      totalQuota: 0,
      usedLinks: 20,
    });
    const { service } = buildService(merchant);

    const result = await service.createForMerchant(merchant.id, {
      customerName: 'Jane Doe',
      customerPhone: '+970591234567',
      items: [{ productName: 'Bracelet' }],
    });

    expect(result.quota.unlimited).toBe(true);
    expect(result.quota.remaining).toBeNull();
    expect(merchant.usedLinks).toBe(21);
  });

  it('loads merchant details using both order and merchant IDs', async () => {
    const orderRepository = {
      findOne: jest.fn().mockResolvedValue(
        Object.assign(new Order(), {
          id: '3d76fa82-17f0-4fa7-b499-d784cc2a2ab5',
          merchantId: '7f8d9f0e-01f8-4b4f-b812-6240310f7de4',
          customerName: 'Jane Doe',
          customerPhone: '+970591234567',
          status: OrderStatus.PENDING,
          source: OrderSource.MERCHANT_PORTAL,
          createdAt: new Date(),
          nfcItems: [
            Object.assign(new NfcItem(), {
              id: 'item-1',
              productName: 'Ring',
              nfcId: 'NFC-TEST',
              editToken: 'c58b3438-aa05-4b5c-8883-d02ff70827aa',
              isLocked: false,
            }),
          ],
        }),
      ),
    };
    const service = new OrdersService(
      orderRepository as any,
      {} as any,
      {} as any,
      {
        get: (_key: string, fallback: string) => fallback,
      } as any,
      {} as any,
    );

    const result = await service.findOneForMerchant(
      '7f8d9f0e-01f8-4b4f-b812-6240310f7de4',
      '3d76fa82-17f0-4fa7-b499-d784cc2a2ab5',
    );

    expect(orderRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: '3d76fa82-17f0-4fa7-b499-d784cc2a2ab5',
        merchantId: '7f8d9f0e-01f8-4b4f-b812-6240310f7de4',
      },
      relations: { nfcItems: true },
    });
    expect(result.items[0].setupPath).toContain(
      'c58b3438-aa05-4b5c-8883-d02ff70827aa',
    );
    expect(result.items[0].setupUrl).toBe(
      'http://localhost:5173/setup/c58b3438-aa05-4b5c-8883-d02ff70827aa',
    );
    expect(result.items[0].viewUrl).toBe('http://localhost:5173/nfc/NFC-TEST');
  });

  it('updates status only through a merchant-scoped lookup', async () => {
    const order = Object.assign(new Order(), {
      id: '3d76fa82-17f0-4fa7-b499-d784cc2a2ab5',
      merchantId: '7f8d9f0e-01f8-4b4f-b812-6240310f7de4',
      customerName: 'Jane Doe',
      customerPhone: '+970591234567',
      status: OrderStatus.PENDING,
      source: OrderSource.MERCHANT_PORTAL,
      createdAt: new Date(),
      nfcItems: [],
    });
    const orderRepository = {
      findOne: jest.fn().mockResolvedValue(order),
      save: jest.fn(async (value: Order) => value),
    };
    const service = new OrdersService(
      orderRepository as any,
      {} as any,
      {} as any,
      { get: (_key: string, fallback: string) => fallback } as any,
      {} as any,
    );

    const result = await service.updateMerchantStatus(
      order.merchantId,
      order.id,
      OrderStatus.COMPLETED,
    );

    expect(orderRepository.findOne).toHaveBeenCalledWith({
      where: { id: order.id, merchantId: order.merchantId },
      relations: { nfcItems: true },
    });
    expect(orderRepository.save).toHaveBeenCalled();
    expect(result.status).toBe(OrderStatus.COMPLETED);
  });

  it('locks an NFC item only after loading its merchant-owned order', async () => {
    const nfcItem = Object.assign(new NfcItem(), {
      id: '63a52a30-0d72-4c95-b9ed-05ff25af37f8',
      productName: 'Ring',
      nfcId: 'NFC-TEST',
      editToken: 'c58b3438-aa05-4b5c-8883-d02ff70827aa',
      isLocked: false,
    });
    const order = Object.assign(new Order(), {
      id: '3d76fa82-17f0-4fa7-b499-d784cc2a2ab5',
      merchantId: '7f8d9f0e-01f8-4b4f-b812-6240310f7de4',
      customerName: 'Jane Doe',
      customerPhone: '+970591234567',
      status: OrderStatus.PENDING,
      source: OrderSource.MERCHANT_PORTAL,
      createdAt: new Date(),
      nfcItems: [nfcItem],
    });
    const orderRepository = { findOne: jest.fn().mockResolvedValue(order) };
    const nfcRepository = { save: jest.fn(async (item: NfcItem) => item) };
    const dataSource = { getRepository: jest.fn(() => nfcRepository) };
    const service = new OrdersService(
      orderRepository as any,
      {} as any,
      dataSource as any,
      { get: (_key: string, fallback: string) => fallback } as any,
      {} as any,
    );

    const result = await service.updateMerchantNfcLock(
      order.merchantId,
      order.id,
      nfcItem.id,
      true,
    );

    expect(orderRepository.findOne).toHaveBeenCalledWith({
      where: { id: order.id, merchantId: order.merchantId },
      relations: { nfcItems: true },
    });
    expect(nfcRepository.save).toHaveBeenCalledWith(nfcItem);
    expect(result.items[0].isLocked).toBe(true);
  });
});
