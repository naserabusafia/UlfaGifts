import {
  Body,
  Controller,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  ApproveQuotaRequestDto,
  CreateQuotaRequestDto,
  QuotaRequestsQueryDto,
  RejectQuotaRequestDto,
} from './dto/quota-request.dto';
import { UserRole } from './entities/user.entity';
import { QuotaRequestsService } from './quota-requests.service';

@Controller('quota-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuotaRequestsController {
  constructor(private readonly quotaRequests: QuotaRequestsService) {}

  // --- merchant ---------------------------------------------------------

  @Post()
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('id') merchantId: string,
    @Body() dto: CreateQuotaRequestDto,
  ) {
    return this.quotaRequests.create(merchantId, dto);
  }

  @Get('mine')
  @Roles(UserRole.MERCHANT)
  findMine(@CurrentUser('id') merchantId: string) {
    return this.quotaRequests.findForMerchant(merchantId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.MERCHANT)
  cancel(
    @CurrentUser('id') merchantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quotaRequests.cancelByMerchant(merchantId, id);
  }

  // --- super admin ------------------------------------------------------

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll(@Query() query: QuotaRequestsQueryDto) {
    return this.quotaRequests.findAll(query);
  }

  @Get('pending-count')
  @Roles(UserRole.SUPER_ADMIN)
  pendingCount() {
    return this.quotaRequests.countPending();
  }

  @Patch(':id/approve')
  @Roles(UserRole.SUPER_ADMIN)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ApproveQuotaRequestDto,
  ) {
    return this.quotaRequests.approve(id, adminId, dto);
  }

  @Patch(':id/reject')
  @Roles(UserRole.SUPER_ADMIN)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: RejectQuotaRequestDto,
  ) {
    return this.quotaRequests.reject(id, adminId, dto);
  }
}
