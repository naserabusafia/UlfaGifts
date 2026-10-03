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
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AddQuotaDto } from './dto/add-quota.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserRole } from './entities/user.entity';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll(@Query() paginationDto: PaginationDto) {
    return this.usersService.findAll(paginationDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN)
  toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: any },
    @CurrentUser() currentUser: User,
  ) {
    return this.usersService.update(id, { status: body.status }, currentUser?.id);
  }

  @Patch(':id/first-login-password')
  @HttpCode(HttpStatus.OK)
  changeFirstLoginPasswordById(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { newPassword?: string; password?: string },
  ) {
    const password = body.newPassword || body.password;
    return this.usersService.changeFirstLoginPassword(id, password);
  }

  @Patch('first-login-password')
  @HttpCode(HttpStatus.OK)
  changeFirstLoginPasswordMe(
    @CurrentUser() currentUser: User,
    @Body() body: { newPassword?: string; password?: string },
  ) {
    const password = body.newPassword || body.password;
    return this.usersService.changeFirstLoginPassword(currentUser?.id, password);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.usersService.update(id, updateUserDto, currentUser?.id);
  }

  @Post(':id/quota')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  addQuota(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addQuotaDto: AddQuotaDto,
    @CurrentUser() admin: User,
  ) {
    return this.usersService.addQuota(id, addQuotaDto, admin.id);
  }

  @Post(':id/reset-password')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  resetPassword(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.resetPassword(id);
  }

  @Get(':id/quota-logs')
  @Roles(UserRole.SUPER_ADMIN, UserRole.MERCHANT)
  getQuotaLogs(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getQuotaLogs(id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
