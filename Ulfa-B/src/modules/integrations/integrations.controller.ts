import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Get,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CancelIntegrationOrderDto } from '../orders/dto/cancel-integration-order.dto';
import { CreateIntegrationOrderDto } from '../orders/dto/create-integration-order.dto';
import { OrderSource } from '../orders/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { UserRole } from '../users/entities/user.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeyGuard } from './guards/api-key.guard';
import { IntegrationApiKeysService } from './integration-api-keys.service';

@Controller('merchant/integration-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT)
export class IntegrationApiKeysController {
  constructor(private readonly apiKeysService: IntegrationApiKeysService) {}

  @Post()
  create(
    @CurrentUser('id') merchantId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(merchantId, dto);
  }

  @Get()
  findAll(@CurrentUser('id') merchantId: string) {
    return this.apiKeysService.findAll(merchantId);
  }

  @Delete(':id')
  revoke(
    @CurrentUser('id') merchantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.apiKeysService.revoke(merchantId, id);
  }
}

@Controller('integrations/v1/orders')
@UseGuards(ApiKeyGuard)
export class IntegrationOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('id') merchantId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateIntegrationOrderDto,
  ) {
    const normalizedKey = idempotencyKey?.trim();
    if (!normalizedKey || normalizedKey.length > 128) {
      throw new BadRequestException(
        'Idempotency-Key header is required and must be at most 128 characters',
      );
    }

    return this.ordersService.createForMerchant(merchantId, dto, {
      source: OrderSource.EXTERNAL_API,
      idempotencyKey: normalizedKey,
    });
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser('id') merchantId: string,
    @Body() dto: CancelIntegrationOrderDto,
  ) {
    return this.ordersService.cancelForIntegration(
      merchantId,
      dto.idempotencyKey,
    );
  }
}

