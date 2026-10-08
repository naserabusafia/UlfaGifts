import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Brackets, DataSource, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import {
  DEFAULT_NFC_OCCASION,
  DEFAULT_NFC_THEME,
  NfcItem,
} from '../nfc-items/entities/nfc-item.entity';
import { ThemeOccasion } from '../nfc-items/entities/theme-occasion.entity';
import { OccasionSection } from '../nfc-items/entities/occasion-section.entity';
import { normalizePhoneNumber } from '../../common/utils/phone.util';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateMerchantOrderDto } from './dto/create-merchant-order.dto';
import { CreateAdminOrderDto } from './dto/create-admin-order.dto';
import { OrdersQueryDto } from './dto/orders-query.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Order, OrderSource, OrderStatus } from './entities/order.entity';
import { ItemMedia } from '../nfc-items/entities/item-media.entity';
import { StorageService } from '../storage/storage.service';
import { retentionHoursFrom } from './cancelled-content.purger';

/**
 * Where the buyer is with an item's setup: hasn't started, started (secret set,
 * not published yet), or published and ready for the recipient.
 */
export type SetupState = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY';

export const setupStateOf = (
  item: Pick<NfcItem, 'keySalt' | 'publishedAt'>,
): SetupState => {
  if (item.publishedAt) return 'READY';
  return item.keySalt ? 'IN_PROGRESS' : 'NOT_STARTED';
};

export interface CreatedMerchantOrder {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  externalOrderId?: string;
  status: OrderStatus;
  createdAt: Date;
  source: OrderSource;
  items: Array<{
    id: string;
    productName: string;
    nfcId: string;
    setupToken: string;
    setupPath: string;
    setupUrl: string;
    viewUrl: string;
    giftCount: number;
  }>;
  quota: {
    unlimited: boolean;
    used: number;
    total: number;
    remaining: number | null;
  };
}

export interface MerchantOrderView {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone?: string;
  externalOrderId?: string;
  status: OrderStatus;
  source: OrderSource;
  createdAt: Date;
  cancelledAt: Date | null;
  contentPurgedAt: Date | null;
  // When the buyer's uploads will be deleted; null once done or not cancelled.
  contentDeletesAt: Date | null;
  items: Array<{
    id: string;
    productName: string;
    nfcId: string;
    isLocked: boolean;
    lockReason: string | null;
    giftCount: number;
    quotaCharged: boolean;
    setupState: SetupState;
    publishedAt: Date | null;
    setupPath: string;
    setupUrl: string;
    viewUrl: string;
  }>;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly storage: StorageService,
  ) {}

  private sanitizeOrder(order: Order): Order {
    if (order.merchant) {
      delete (order.merchant as Partial<User>).passwordHash;
    }

    order.nfcItems?.forEach((item) => {
      delete item.creatorPasswordHash;
      delete item.viewerPasswordHash;
      delete item.editToken;
    });

    return order;
  }

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const { merchantId, ...orderData } = createOrderDto;
    if (orderData.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('An order cannot be created as cancelled');
    }

    // Validate merchant exists (this will throw NotFoundException if not found)
    const merchant = await this.usersService.findOne(merchantId);

    const order = this.orderRepository.create({
      ...orderData,
      merchantId: merchant.id,
      source: OrderSource.ADMIN,
      merchant,
    });

    return await this.orderRepository.save(order);
  }

  async createForMerchant(
    merchantId: string,
    createOrderDto: CreateMerchantOrderDto,
    options?: {
      source?: OrderSource;
      idempotencyKey?: string;
      // Admins can create orders whose links don't use the merchant's quota.
      chargeQuota?: boolean;
    },
  ): Promise<CreatedMerchantOrder> {
    const shared =
      createOrderDto.linkMode === 'SHARED' && createOrderDto.items.length > 1;
    // Quota counts links: a shared link is one link however many gifts carry it.
    const itemCount = shared ? 1 : createOrderDto.items.length;
    const source = options?.source ?? OrderSource.MERCHANT_PORTAL;
    const idempotencyKey = options?.idempotencyKey?.trim();
    const chargeQuota = options?.chargeQuota !== false;

    return this.dataSource.transaction(async (manager) => {
      if (idempotencyKey) {
        const previousOrder = await manager.findOne(Order, {
          where: { merchantId, idempotencyKey },
          relations: { nfcItems: true },
        });

        if (previousOrder) {
          const merchant = await manager.findOneByOrFail(User, {
            id: merchantId,
          });
          return this.toCreatedMerchantOrder(previousOrder, merchant);
        }
      }

      const merchant = await manager.findOne(User, {
        where: { id: merchantId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!merchant || merchant.role !== UserRole.MERCHANT) {
        throw new ForbiddenException('A valid merchant account is required');
      }

      if (merchant.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException('MERCHANT_ACCOUNT_NOT_ACTIVE');
      }

      const usedLinks = merchant.usedLinks || 0;
      const totalQuota = merchant.totalQuota || 0;
      const availableQuota = Math.max(0, totalQuota - usedLinks);

      if (
        chargeQuota &&
        !merchant.isUnlimitedQuota &&
        availableQuota < itemCount
      ) {
        throw new ForbiddenException({
          code: 'NFC_QUOTA_EXCEEDED',
          message: `Insufficient NFC quota. Requested ${itemCount}, available ${availableQuota}`,
          requested: itemCount,
          available: availableQuota,
        });
      }

      const order = await manager.save(
        Order,
        manager.create(Order, {
          merchantId: merchant.id,
          merchant,
          customerName: createOrderDto.customerName.trim(),
          customerPhone: normalizePhoneNumber(
            createOrderDto.customerPhone,
          ) as string,
          externalOrderId: createOrderDto.externalOrderId?.trim() || undefined,
          source,
          idempotencyKey: idempotencyKey || undefined,
          status: OrderStatus.PENDING,
        }),
      );

      // New items start on the default occasion and its default sections;
      // the buyer can change both during setup.
      const occasion = await manager.findOne(ThemeOccasion, {
        where: {
          key: DEFAULT_NFC_OCCASION,
          isActive: true,
          theme: { key: DEFAULT_NFC_THEME, isActive: true },
        },
      });
      if (!occasion) {
        throw new InternalServerErrorException(
          `Default occasion "${DEFAULT_NFC_THEME}/${DEFAULT_NFC_OCCASION}" is missing`,
        );
      }
      const defaultSections = await manager.find(OccasionSection, {
        where: { occasionId: occasion.id },
        order: { displayOrder: 'ASC' },
      });

      const linkItems = shared
        ? [
            {
              productName: createOrderDto.items
                .map((item) => item.productName.trim())
                .join(' + '),
              giftCount: createOrderDto.items.length,
            },
          ]
        : createOrderDto.items.map((item) => ({
            productName: item.productName.trim(),
            giftCount: 1,
          }));

      const items = linkItems.map((item, index) =>
        manager.create(NfcItem, {
          productName: item.productName,
          giftCount: item.giftCount,
          quotaCharged: chargeQuota,
          nfcId: this.generateNfcId(
            this.buildLinkPrefix(order, index, itemCount),
          ),
          editToken: crypto.randomUUID(),
          occasion,
          itemSections: defaultSections.map((section) => ({
            sectionId: section.sectionId,
            displayOrder: section.displayOrder,
            isVisible: true,
          })),
          order,
        }),
      );
      const savedItems = await manager.save(NfcItem, items);

      if (chargeQuota) {
        merchant.usedLinks = usedLinks + itemCount;
        await manager.save(User, merchant);
      }

      order.nfcItems = savedItems;
      return this.toCreatedMerchantOrder(order, merchant);
    });
  }

  private generateNfcId(prefix: string): string {
    return `${prefix}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  }

  /**
   * Readable prefix shared by an item's setup and view links so they can be
   * matched at a glance: order number (+ item letter when the order has
   * several items) and the last 3 digits of the customer's phone, e.g.
   * "1047-382" or "1047B-382". The random part after it is what secures them.
   */
  private buildLinkPrefix(order: Order, index: number, count: number): string {
    const letter = count > 1 ? String.fromCharCode(65 + (index % 26)) : '';
    const phoneTail = (order.customerPhone || '').replace(/\D/g, '').slice(-3);
    return [`${order.orderNumber}${letter}`, phoneTail].filter(Boolean).join('-');
  }

  /** Setup slug = the nfcId's readable prefix + the edit token. */
  private buildSetupSlug(item: NfcItem): string {
    const token = item.editToken as string;
    const cut = item.nfcId.lastIndexOf('-');
    const prefix = cut > 0 ? item.nfcId.slice(0, cut) : '';
    // Items created before prefixes existed use the plain "NFC-" form.
    return prefix && prefix !== 'NFC' ? `${prefix}-${token}` : token;
  }

  private buildNfcUrl(type: 'setup' | 'view', identifier: string): string {
    const configKey =
      type === 'setup' ? 'app.nfcSetupBaseUrl' : 'app.nfcViewBaseUrl';
    const fallback =
      type === 'setup'
        ? 'http://localhost:5173/setup'
        : 'http://localhost:5173/nfc';
    const baseUrl = this.configService.get<string>(configKey, fallback);
    return `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(identifier)}`;
  }

  private toCreatedMerchantOrder(
    order: Order,
    merchant: User,
  ): CreatedMerchantOrder {
    const used = merchant.usedLinks || 0;
    const total = merchant.totalQuota || 0;

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone as string,
      externalOrderId: order.externalOrderId,
      status: order.status,
      createdAt: order.createdAt,
      source: order.source,
      items: (order.nfcItems || []).map((item) => ({
        id: item.id,
        productName: item.productName,
        nfcId: item.nfcId,
        setupToken: item.editToken as string,
        setupPath: `/setup/${this.buildSetupSlug(item)}`,
        setupUrl: this.buildNfcUrl('setup', this.buildSetupSlug(item)),
        viewUrl: this.buildNfcUrl('view', item.nfcId),
        giftCount: item.giftCount ?? 1,
      })),
      quota: {
        unlimited: merchant.isUnlimitedQuota,
        used,
        total,
        remaining: merchant.isUnlimitedQuota ? null : Math.max(0, total - used),
      },
    };
  }

  async findAllForMerchant(merchantId: string, queryDto: OrdersQueryDto) {
    const { page = 1, limit = 10, search, status, dateFrom, dateTo } = queryDto;
    const skip = (page - 1) * limit;
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.nfcItems', 'nfcItem')
      .where('order.merchantId = :merchantId', { merchantId });

    if (search) {
      queryBuilder.andWhere(
        new Brackets((builder) => {
          builder
            .where('order.customerName ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('order.customerPhone ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('order.externalOrderId ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('CAST(order.id AS TEXT) ILIKE :search', {
              search: `%${search}%`,
            });
        }),
      );
    }
    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }
    if (dateFrom) {
      queryBuilder.andWhere('order.createdAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      queryBuilder.andWhere('order.createdAt <= :dateTo', { dateTo });
    }

    queryBuilder.skip(skip).take(limit).orderBy('order.createdAt', 'DESC');

    const [[orders, total], pending, completed, cancelled] = await Promise.all([
      queryBuilder.getManyAndCount(),
      this.orderRepository.countBy({ merchantId, status: OrderStatus.PENDING }),
      this.orderRepository.countBy({
        merchantId,
        status: OrderStatus.COMPLETED,
      }),
      this.orderRepository.countBy({
        merchantId,
        status: OrderStatus.CANCELLED,
      }),
    ]);

    return {
      items: orders.map((order) => this.toMerchantOrderView(order)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      // Cancelled orders are counted apart and left out of the total.
      summary: { total: pending + completed, pending, completed, cancelled },
    };
  }

  async findOneForMerchant(
    merchantId: string,
    id: string,
  ): Promise<MerchantOrderView> {
    const order = await this.orderRepository.findOne({
      where: { id, merchantId },
      relations: { nfcItems: true },
    });
    if (!order) {
      // Deliberately use 404 for both missing and foreign orders to avoid
      // revealing whether another merchant owns the supplied UUID.
      throw new NotFoundException(`Order with ID "${id}" not found`);
    }
    return this.toMerchantOrderView(order);
  }

  async updateMerchantStatus(
    merchantId: string,
    id: string,
    status: OrderStatus,
  ): Promise<MerchantOrderView> {
    const order = await this.orderRepository.findOne({
      where: { id, merchantId },
      relations: { nfcItems: true },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found`);
    }

    if (status === OrderStatus.CANCELLED) {
      return this.toMerchantOrderView(await this.cancel(order.id, merchantId));
    }
    if (order.status === OrderStatus.CANCELLED) {
      return this.toMerchantOrderView(
        await this.restore(order.id, status, merchantId),
      );
    }

    order.status = status;
    const updatedOrder = await this.orderRepository.save(order);
    return this.toMerchantOrderView(updatedOrder);
  }

  private assertNotCancelled(order: Order) {
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException({
        message: 'ORDER_CANCELLED',
        code: 'ORDER_CANCELLED',
      });
    }
  }

  /**
   * Cancels an order once: every link is locked, the quota its items were
   * charged goes back to the merchant, and the order is stamped so the
   * buyer's uploads can be deleted after the retention window. Cancelling an
   * already cancelled order changes nothing.
   */
  async cancel(orderId: string, merchantId?: string): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: merchantId ? { id: orderId, merchantId } : { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID "${orderId}" not found`);
      }
      const items = await manager.find(NfcItem, {
        where: { order: { id: order.id } },
      });
      order.nfcItems = items;
      if (order.status === OrderStatus.CANCELLED) return order;

      const refund = items.filter((item) => item.quotaCharged !== false).length;
      if (refund > 0) {
        const merchant = await manager.findOne(User, {
          where: { id: order.merchantId },
          lock: { mode: 'pessimistic_write' },
        });
        if (merchant) {
          merchant.usedLinks = Math.max(0, (merchant.usedLinks || 0) - refund);
          await manager.save(User, merchant);
        }
      }

      for (const item of items) {
        if (!item.isLocked) {
          item.isLocked = true;
          item.lockedByCancel = true;
        }
      }
      if (items.length) await manager.save(NfcItem, items);

      order.status = OrderStatus.CANCELLED;
      order.cancelledAt = new Date();
      await manager.save(Order, order);
      return order;
    });
  }

  /**
   * Cancels the order a connected store created with this Idempotency-Key,
   * when the store cancels its own order or takes it back as a return.
   * Repeating the call changes nothing.
   */
  async cancelForIntegration(
    merchantId: string,
    idempotencyKey: string,
  ): Promise<{ id: string; status: OrderStatus; cancelledAt: Date | null }> {
    const order = await this.orderRepository.findOne({
      where: { merchantId, idempotencyKey: idempotencyKey.trim() },
    });
    if (!order) {
      throw new NotFoundException({
        message: 'ORDER_NOT_FOUND',
        code: 'ORDER_NOT_FOUND',
      });
    }
    const cancelled = await this.cancel(order.id, merchantId);
    return {
      id: cancelled.id,
      status: cancelled.status,
      cancelledAt: cancelled.cancelledAt ?? null,
    };
  }

  /**
   * Undoes a cancellation while the retention window is open: the quota is
   * charged again (refused when the merchant no longer has enough), the links
   * the cancellation locked are unlocked, and clearing cancelledAt takes the
   * order off the deletion schedule. Once the window has passed the buyer's
   * uploads are, or are about to be, deleted, so the order stays cancelled.
   */
  async restore(
    orderId: string,
    status: OrderStatus.PENDING | OrderStatus.COMPLETED,
    merchantId?: string,
  ): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: merchantId ? { id: orderId, merchantId } : { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID "${orderId}" not found`);
      }
      const items = await manager.find(NfcItem, {
        where: { order: { id: order.id } },
      });
      order.nfcItems = items;
      if (order.status !== OrderStatus.CANCELLED) return order;

      const deletesAt = this.contentDeletesAt(order);
      if (order.contentPurgedAt || (deletesAt && deletesAt <= new Date())) {
        throw new BadRequestException({
          message: 'RESTORE_WINDOW_PASSED',
          code: 'RESTORE_WINDOW_PASSED',
        });
      }

      const charge = items.filter((item) => item.quotaCharged !== false).length;
      if (charge > 0) {
        const merchant = await manager.findOne(User, {
          where: { id: order.merchantId },
          lock: { mode: 'pessimistic_write' },
        });
        if (merchant) {
          const used = merchant.usedLinks || 0;
          const available = Math.max(0, (merchant.totalQuota || 0) - used);
          if (!merchant.isUnlimitedQuota && available < charge) {
            throw new ForbiddenException({
              code: 'NFC_QUOTA_EXCEEDED',
              message: `Insufficient NFC quota. Requested ${charge}, available ${available}`,
              requested: charge,
              available,
            });
          }
          merchant.usedLinks = used + charge;
          await manager.save(User, merchant);
        }
      }

      for (const item of items) {
        if (item.lockedByCancel) {
          item.isLocked = false;
          item.lockedByCancel = false;
        }
      }
      if (items.length) await manager.save(NfcItem, items);

      order.status = status;
      order.cancelledAt = null;
      await manager.save(Order, order);
      return order;
    });
  }

  /** When a cancelled order's uploads get deleted; null when not scheduled. */
  private contentDeletesAt(order: Order): Date | null {
    if (!order.cancelledAt || order.contentPurgedAt) return null;
    return new Date(
      new Date(order.cancelledAt).getTime() +
        retentionHoursFrom(this.configService) * 3_600_000,
    );
  }

  async updateMerchantNfcLock(
    merchantId: string,
    orderId: string,
    itemId: string,
    isLocked: boolean,
    lockReason?: string,
  ): Promise<MerchantOrderView> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, merchantId },
      relations: { nfcItems: true },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID "${orderId}" not found`);
    }

    const item = order.nfcItems?.find((nfcItem) => nfcItem.id === itemId);
    if (!item) {
      throw new NotFoundException('NFC item not found in this order');
    }
    // A cancelled order's links were refunded; reopening one would make it free.
    this.assertNotCancelled(order);

    item.isLocked = isLocked;
    item.lockReason = isLocked ? lockReason?.trim() || null : null;
    await this.dataSource.getRepository(NfcItem).save(item);
    return this.toMerchantOrderView(order);
  }

  private toMerchantOrderView(order: Order): MerchantOrderView {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      externalOrderId: order.externalOrderId,
      status: order.status,
      source: order.source,
      createdAt: order.createdAt,
      cancelledAt: order.cancelledAt ?? null,
      contentPurgedAt: order.contentPurgedAt ?? null,
      contentDeletesAt: this.contentDeletesAt(order),
      items: (order.nfcItems || []).map((item) => ({
        id: item.id,
        productName: item.productName,
        nfcId: item.nfcId,
        isLocked: item.isLocked,
        lockReason: item.lockReason ?? null,
        giftCount: item.giftCount ?? 1,
        quotaCharged: item.quotaCharged !== false,
        setupState: setupStateOf(item),
        publishedAt: item.publishedAt ?? null,
        setupPath: `/setup/${this.buildSetupSlug(item)}`,
        setupUrl: this.buildNfcUrl('setup', this.buildSetupSlug(item)),
        viewUrl: this.buildNfcUrl('view', item.nfcId),
      })),
    };
  }

  async findAll(queryDto: OrdersQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      merchantId,
      dateFrom,
      dateTo,
    } = queryDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.merchant', 'merchant');

    if (search) {
      queryBuilder.andWhere(
        new Brackets((builder) => {
          builder
            .where('order.customerName ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('order.customerPhone ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('order.externalOrderId ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('CAST(order.id AS TEXT) ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('merchant.companyName ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('merchant.email ILIKE :search', {
              search: `%${search}%`,
            });
        }),
      );
    }

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    if (merchantId) {
      queryBuilder.andWhere('merchant.id = :merchantId', { merchantId });
    }

    if (dateFrom) {
      queryBuilder.andWhere('order.createdAt >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      queryBuilder.andWhere('order.createdAt <= :dateTo', { dateTo });
    }

    queryBuilder.skip(skip).take(limit).orderBy('order.createdAt', 'DESC');

    const [[items, total], pending, completed, cancelled] = await Promise.all([
      queryBuilder.getManyAndCount(),
      this.orderRepository.countBy({ status: OrderStatus.PENDING }),
      this.orderRepository.countBy({ status: OrderStatus.COMPLETED }),
      this.orderRepository.countBy({ status: OrderStatus.CANCELLED }),
    ]);

    items.forEach((order) => this.sanitizeOrder(order));

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      // Cancelled orders are counted apart and left out of the total.
      summary: {
        total: pending + completed,
        pending,
        completed,
        cancelled,
      },
    };
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { merchant: true, nfcItems: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found`);
    }

    // The links are built before sanitizing drops the edit tokens they use.
    const links = new Map(
      (order.nfcItems || []).map((item) => [
        item.id,
        {
          setupState: setupStateOf(item),
          setupUrl: item.editToken
            ? this.buildNfcUrl('setup', this.buildSetupSlug(item))
            : null,
          viewUrl: this.buildNfcUrl('view', item.nfcId),
        },
      ]),
    );
    this.sanitizeOrder(order);
    order.nfcItems?.forEach((item) => Object.assign(item, links.get(item.id)));
    return order;
  }

  /** Admin: a full order with items and links, for any merchant. */
  async createForAdmin(
    dto: CreateAdminOrderDto,
  ): Promise<CreatedMerchantOrder> {
    const { merchantId, chargeQuota, ...orderDto } = dto;
    return this.createForMerchant(merchantId, orderDto, {
      source: OrderSource.ADMIN,
      chargeQuota,
    });
  }

  async update(id: string, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { merchant: true },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found`);
    }

    const { merchantId, status, ...orderData } = updateOrderDto;

    // Cancelling and restoring go through cancel()/restore() so quota and
    // locks follow; a cancelled order is otherwise left as it is.
    if (order.status === OrderStatus.CANCELLED) {
      if (!status || status === OrderStatus.CANCELLED) {
        this.assertNotCancelled(order);
      }
      const restored = await this.restore(
        order.id,
        status as OrderStatus.PENDING | OrderStatus.COMPLETED,
      );
      order.status = restored.status;
      order.cancelledAt = restored.cancelledAt;
    } else if (status === OrderStatus.CANCELLED) {
      const cancelled = await this.cancel(order.id);
      order.status = cancelled.status;
      order.cancelledAt = cancelled.cancelledAt;
    } else if (status) {
      order.status = status;
    }

    if (merchantId) {
      const merchant = await this.usersService.findOne(merchantId);
      order.merchant = merchant;
      order.merchantId = merchant.id;
    }

    Object.assign(order, orderData);
    const updatedOrder = await this.orderRepository.save(order);

    return this.sanitizeOrder(updatedOrder);
  }

  async remove(id: string): Promise<{ message: string }> {
    const order = await this.orderRepository.findOne({
      where: { id },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found`);
    }
    // Deleting the order cascades to its items and media rows, but not to
    // the stored files: remove those first.
    const media = await this.dataSource
      .getRepository(ItemMedia)
      .createQueryBuilder('media')
      .innerJoin('media.nfcItem', 'item')
      .where('item.order_id = :id', { id })
      .getMany();
    await this.storage.deleteMany(
      media.flatMap((m) => [m.storageKey, m.thumbKey] as string[]),
    );
    await this.orderRepository.remove(order);
    return { message: `Order with ID "${id}" has been deleted successfully` };
  }
}
