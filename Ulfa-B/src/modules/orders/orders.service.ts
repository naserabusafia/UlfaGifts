import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Brackets, DataSource, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { NfcItem } from '../nfc-items/entities/nfc-item.entity';
import { normalizePhoneNumber } from '../../common/utils/phone.util';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateMerchantOrderDto } from './dto/create-merchant-order.dto';
import { OrdersQueryDto } from './dto/orders-query.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Order, OrderSource, OrderStatus } from './entities/order.entity';

export interface CreatedMerchantOrder {
  id: string;
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
  customerName: string;
  customerPhone?: string;
  externalOrderId?: string;
  status: OrderStatus;
  source: OrderSource;
  createdAt: Date;
  items: Array<{
    id: string;
    productName: string;
    nfcId: string;
    isLocked: boolean;
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
    },
  ): Promise<CreatedMerchantOrder> {
    const itemCount = createOrderDto.items.length;
    const source = options?.source ?? OrderSource.MERCHANT_PORTAL;
    const idempotencyKey = options?.idempotencyKey?.trim();

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

      if (!merchant.isUnlimitedQuota && availableQuota < itemCount) {
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

      const items = createOrderDto.items.map((item) =>
        manager.create(NfcItem, {
          productName: item.productName.trim(),
          nfcId: this.generateNfcId(),
          editToken: crypto.randomUUID(),
          order,
        }),
      );
      const savedItems = await manager.save(NfcItem, items);

      merchant.usedLinks = usedLinks + itemCount;
      await manager.save(User, merchant);

      order.nfcItems = savedItems;
      return this.toCreatedMerchantOrder(order, merchant);
    });
  }

  private generateNfcId(): string {
    return `NFC-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
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
        setupPath: `/setup/${item.editToken}`,
        setupUrl: this.buildNfcUrl('setup', item.editToken as string),
        viewUrl: this.buildNfcUrl('view', item.nfcId),
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

    const [[orders, total], pending, completed] = await Promise.all([
      queryBuilder.getManyAndCount(),
      this.orderRepository.countBy({ merchantId, status: OrderStatus.PENDING }),
      this.orderRepository.countBy({
        merchantId,
        status: OrderStatus.COMPLETED,
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
      summary: { total: pending + completed, pending, completed },
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

    order.status = status;
    const updatedOrder = await this.orderRepository.save(order);
    return this.toMerchantOrderView(updatedOrder);
  }

  async updateMerchantNfcLock(
    merchantId: string,
    orderId: string,
    itemId: string,
    isLocked: boolean,
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

    item.isLocked = isLocked;
    await this.dataSource.getRepository(NfcItem).save(item);
    return this.toMerchantOrderView(order);
  }

  private toMerchantOrderView(order: Order): MerchantOrderView {
    return {
      id: order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      externalOrderId: order.externalOrderId,
      status: order.status,
      source: order.source,
      createdAt: order.createdAt,
      items: (order.nfcItems || []).map((item) => ({
        id: item.id,
        productName: item.productName,
        nfcId: item.nfcId,
        isLocked: item.isLocked,
        setupPath: `/setup/${item.editToken}`,
        setupUrl: this.buildNfcUrl('setup', item.editToken as string),
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

    const [[items, total], pending, completed] = await Promise.all([
      queryBuilder.getManyAndCount(),
      this.orderRepository.countBy({ status: OrderStatus.PENDING }),
      this.orderRepository.countBy({ status: OrderStatus.COMPLETED }),
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
      summary: {
        total: pending + completed,
        pending,
        completed,
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

    return this.sanitizeOrder(order);
  }

  async update(id: string, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { merchant: true },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found`);
    }

    const { merchantId, ...orderData } = updateOrderDto;

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
    await this.orderRepository.remove(order);
    return { message: `Order with ID "${id}" has been deleted successfully` };
  }
}
