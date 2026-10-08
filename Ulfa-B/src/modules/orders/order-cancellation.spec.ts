import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ItemContent } from '../nfc-items/entities/item-content.entity';
import { ItemMedia } from '../nfc-items/entities/item-media.entity';
import { NfcItem } from '../nfc-items/entities/nfc-item.entity';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { CancelledContentPurger } from './cancelled-content.purger';
import { Order, OrderSource, OrderStatus } from './entities/order.entity';
import { OrdersService } from './orders.service';

const MERCHANT_ID = '7f8d9f0e-01f8-4b4f-b812-6240310f7de4';
const ORDER_ID = '3d76fa82-17f0-4fa7-b499-d784cc2a2ab5';

const item = (id: string, overrides: Partial<NfcItem> = {}) =>
  Object.assign(new NfcItem(), {
    id,
    productName: 'Ring',
    nfcId: `NFC-${id}`,
    editToken: 'c58b3438-aa05-4b5c-8883-d02ff70827aa',
    isLocked: false,
    quotaCharged: true,
    ...overrides,
  });

const setup = (
  status = OrderStatus.PENDING,
  items = [item('a'), item('b')],
) => {
  const merchant = Object.assign(new User(), {
    id: MERCHANT_ID,
    role: UserRole.MERCHANT,
    status: UserStatus.ACTIVE,
    totalQuota: 10,
    usedLinks: 6,
  });
  const order = Object.assign(new Order(), {
    id: ORDER_ID,
    merchantId: MERCHANT_ID,
    customerName: 'Jane Doe',
    status,
    source: OrderSource.MERCHANT_PORTAL,
    createdAt: new Date(),
    nfcItems: items,
  });
  const manager = {
    findOne: jest.fn(async (entity: unknown) =>
      entity === Order ? order : entity === User ? merchant : null,
    ),
    find: jest.fn(async () => items),
    save: jest.fn(async (_entity: unknown, value: unknown) => value),
  };
  const orderRepository = {
    findOne: jest.fn().mockResolvedValue(order),
    save: jest.fn(async (value: Order) => value),
  };
  const service = new OrdersService(
    orderRepository as any,
    {} as any,
    {
      transaction: jest.fn((cb: (m: any) => unknown) => cb(manager)),
      getRepository: jest.fn(() => ({ save: jest.fn() })),
    } as any,
    { get: (_key: string, fallback: string) => fallback } as any,
    {} as any,
  );
  return { service, order, merchant, items, manager };
};

describe('Order cancellation', () => {
  it('locks every link, refunds the charged quota and stamps the order', async () => {
    const { service, merchant, items } = setup();

    const view = await service.updateMerchantStatus(
      MERCHANT_ID,
      ORDER_ID,
      OrderStatus.CANCELLED,
    );

    expect(view.status).toBe(OrderStatus.CANCELLED);
    expect(view.cancelledAt).toBeInstanceOf(Date);
    expect(merchant.usedLinks).toBe(4);
    expect(items.every((i) => i.isLocked)).toBe(true);
    expect(view.items.every((i) => i.isLocked)).toBe(true);
  });

  it('refunds only the items that used quota', async () => {
    const { service, merchant } = setup(OrderStatus.COMPLETED, [
      item('a'),
      item('b', { quotaCharged: false }),
    ]);
    await service.cancel(ORDER_ID, MERCHANT_ID);
    expect(merchant.usedLinks).toBe(5);
  });

  it('never refunds twice', async () => {
    const { service, merchant } = setup();
    await service.cancel(ORDER_ID, MERCHANT_ID);
    await service.cancel(ORDER_ID, MERCHANT_ID);
    expect(merchant.usedLinks).toBe(4);
  });

  it('restores within the window: charges the quota again, reopens only its own locks, drops the deletion', async () => {
    const merchantLocked = item('b', {
      isLocked: true,
      lockReason: 'Waiting for payment',
    });
    const { service, order, merchant, items } = setup(OrderStatus.PENDING, [
      item('a'),
      merchantLocked,
    ]);
    await service.cancel(ORDER_ID, MERCHANT_ID);
    expect(merchant.usedLinks).toBe(4);

    const view = await service.updateMerchantStatus(
      MERCHANT_ID,
      ORDER_ID,
      OrderStatus.PENDING,
    );

    expect(view.status).toBe(OrderStatus.PENDING);
    expect(order.cancelledAt).toBeNull();
    expect(view.contentDeletesAt).toBeNull();
    expect(merchant.usedLinks).toBe(6);
    expect(items[0].isLocked).toBe(false);
    expect(items[1].isLocked).toBe(true); // the merchant's own lock stays
    expect(items[1].lockReason).toBe('Waiting for payment');
  });

  it('refuses to restore when the quota has run out since', async () => {
    const { service, merchant, items } = setup();
    await service.cancel(ORDER_ID, MERCHANT_ID);
    merchant.usedLinks = 9; // only 1 left, the order needs 2

    await expect(
      service.updateMerchantStatus(MERCHANT_ID, ORDER_ID, OrderStatus.PENDING),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(merchant.usedLinks).toBe(9);
    expect(items.every((i) => i.isLocked)).toBe(true);
  });

  it('cannot restore once the retention window has passed', async () => {
    const { service, order } = setup(OrderStatus.CANCELLED);
    order.cancelledAt = new Date(Date.now() - 73 * 3_600_000);
    await expect(
      service.updateMerchantStatus(MERCHANT_ID, ORDER_ID, OrderStatus.PENDING),
    ).rejects.toMatchObject({ response: { code: 'RESTORE_WINDOW_PASSED' } });
  });

  it('cannot restore after the uploads were deleted', async () => {
    const { service, order } = setup(OrderStatus.CANCELLED);
    order.cancelledAt = new Date();
    order.contentPurgedAt = new Date();
    await expect(
      service.updateMerchantStatus(
        MERCHANT_ID,
        ORDER_ID,
        OrderStatus.COMPLETED,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancels a store order by the key it was created with', async () => {
    const { service, merchant, items } = setup();
    const repo = (service as any).orderRepository;

    const result = await service.cancelForIntegration(
      MERCHANT_ID,
      ' store-order-1 ',
    );

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { merchantId: MERCHANT_ID, idempotencyKey: 'store-order-1' },
    });
    expect(result.status).toBe(OrderStatus.CANCELLED);
    expect(result.cancelledAt).toBeInstanceOf(Date);
    expect(merchant.usedLinks).toBe(4);
    expect(items.every((i) => i.isLocked)).toBe(true);
  });

  it('answers 404 for a key the merchant never used', async () => {
    const { service } = setup();
    (service as any).orderRepository.findOne.mockResolvedValue(null);
    await expect(
      service.cancelForIntegration(MERCHANT_ID, 'unknown'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not let a refunded link be unlocked again', async () => {
    const { service } = setup(OrderStatus.CANCELLED);
    await expect(
      service.updateMerchantNfcLock(MERCHANT_ID, ORDER_ID, 'a', false),
    ).rejects.toMatchObject({ response: { code: 'ORDER_CANCELLED' } });
  });
});

describe('CancelledContentPurger', () => {
  const build = (due: Order[], current: Partial<Order> = {}) => {
    const orders = {
      find: jest.fn().mockResolvedValueOnce(due).mockResolvedValue([]),
      findOne: jest.fn(async () =>
        Object.assign(new Order(), {
          id: ORDER_ID,
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date('2026-10-01T00:00:00Z'),
          contentPurgedAt: null,
          ...current,
        }),
      ),
      update: jest.fn(),
    };
    const nfcItems = { find: jest.fn().mockResolvedValue([{ id: 'item-1' }]) };
    const media = {
      findBy: jest.fn().mockResolvedValue([
        {
          id: 'm1',
          storageKey: 'items/item-1/m1',
          thumbKey: 'items/item-1/m1.thumb',
        },
        { id: 'm2', storageKey: 'items/item-1/m2', thumbKey: null },
      ]),
    };
    const manager = { delete: jest.fn(), update: jest.fn() };
    const dataSource = {
      getRepository: jest.fn((entity: unknown) =>
        entity === Order ? orders : entity === NfcItem ? nfcItems : media,
      ),
      transaction: jest.fn((cb: (m: any) => unknown) => cb(manager)),
    };
    const storage = { deleteMany: jest.fn() };
    const purger = new CancelledContentPurger(
      dataSource as any,
      storage as any,
      { get: () => undefined } as any,
    );
    return { purger, orders, storage, manager };
  };

  it('deletes stored files, media rows, letters and secrets, then stamps the order', async () => {
    const order = Object.assign(new Order(), {
      id: ORDER_ID,
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date('2026-10-01T00:00:00Z'),
    });
    const { purger, orders, storage, manager } = build([order]);

    await expect(purger.run(new Date('2026-10-06T00:00:00Z'))).resolves.toBe(1);

    expect(storage.deleteMany).toHaveBeenCalledWith([
      'items/item-1/m1',
      'items/item-1/m1.thumb',
      'items/item-1/m2',
      null,
    ]);
    expect(manager.delete).toHaveBeenCalledWith(ItemMedia, expect.anything());
    expect(manager.delete).toHaveBeenCalledWith(ItemContent, expect.anything());
    expect(manager.update).toHaveBeenCalledWith(
      Order,
      { id: ORDER_ID },
      { contentPurgedAt: expect.any(Date) },
    );
    // Only orders cancelled more than 72 hours ago are picked.
    const where = orders.find.mock.calls[0][0].where;
    expect(where.status).toBe(OrderStatus.CANCELLED);
    expect(where.cancelledAt.value).toEqual(new Date('2026-10-03T00:00:00Z'));
  });

  it('skips an order restored after it was picked', async () => {
    const order = Object.assign(new Order(), { id: ORDER_ID });
    const { purger, storage, manager } = build([order], {
      status: OrderStatus.PENDING,
      cancelledAt: null,
    });

    await purger.run();
    expect(storage.deleteMany).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('leaves the order unstamped when storage fails, so the next run retries', async () => {
    const order = Object.assign(new Order(), { id: ORDER_ID });
    const { purger, storage, manager } = build([order]);
    storage.deleteMany.mockRejectedValue(new Error('S3 down'));

    await expect(purger.run()).resolves.toBe(0);
    expect(manager.update).not.toHaveBeenCalled();
  });
});
