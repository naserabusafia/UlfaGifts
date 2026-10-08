import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateMerchantOrderDto } from './dto/create-merchant-order.dto';
import { CreateAdminOrderDto } from './dto/create-admin-order.dto';
import { OrdersQueryDto } from './dto/orders-query.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateMerchantOrderStatusDto } from './dto/update-merchant-order-status.dto';
import { UpdateMerchantNfcLockDto } from './dto/update-merchant-nfc-lock.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  // A full order with items and links, the same as a merchant creates.
  @Post('full')
  @HttpCode(HttpStatus.CREATED)
  createFull(@Body() dto: CreateAdminOrderDto) {
    return this.ordersService.createForAdmin(dto);
  }

  @Get()
  findAll(@Query() queryDto: OrdersQueryDto) {
    return this.ordersService.findAll(queryDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.remove(id);
  }
}

@Controller('merchant/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT)
export class MerchantOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('id') merchantId: string,
    @Body() createOrderDto: CreateMerchantOrderDto,
  ) {
    return this.ordersService.createForMerchant(
      merchantId,
      createOrderDto,
    );
  }

  @Get()
  findAll(
    @CurrentUser('id') merchantId: string,
    @Query() queryDto: OrdersQueryDto,
  ) {
    return this.ordersService.findAllForMerchant(merchantId, queryDto);
  }

  @Get(':id')
  findOne(
    @CurrentUser('id') merchantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.findOneForMerchant(merchantId, id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser('id') merchantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMerchantOrderStatusDto,
  ) {
    return this.ordersService.updateMerchantStatus(merchantId, id, dto.status);
  }

  @Patch(':orderId/items/:itemId/lock')
  updateItemLock(
    @CurrentUser('id') merchantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateMerchantNfcLockDto,
  ) {
    return this.ordersService.updateMerchantNfcLock(
      merchantId,
      orderId,
      itemId,
      dto.isLocked,
      dto.lockReason,
    );
  }
}
