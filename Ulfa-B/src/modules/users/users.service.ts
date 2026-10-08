import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AddQuotaDto } from './dto/add-quota.dto';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { QuotaLog } from './entities/quota-log.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(QuotaLog)
    private readonly quotaLogRepository: Repository<QuotaLog>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const normalizedEmail = createUserDto.email?.toLowerCase().trim();
    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const { password, ...userData } = createUserDto;
    const defaultPassword = password || 'Merchant123!';

    const user = this.userRepository.create({
      ...userData,
      email: normalizedEmail,
      passwordHash: defaultPassword,
      // Every newly-created merchant must choose their own password on first login.
      // Do not allow a client-provided status to bypass that onboarding step.
      status:
        userData.role === UserRole.MERCHANT || !userData.role
          ? UserStatus.PENDING_PASSWORD_SET
          : userData.status || UserStatus.PENDING_PASSWORD_SET,
    });

    const savedUser = await this.userRepository.save(user);
    delete (savedUser as any).passwordHash;
    return savedUser;
  }

  async changeFirstLoginPassword(userId: string, newPassword?: string): Promise<User> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }
    if (newPassword.length > 72) {
      throw new BadRequestException('Password must be at most 72 characters long');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }
    // Without a current password this route is only for the first password;
    // later changes go through PATCH /auth/password.
    if (user.status !== UserStatus.PENDING_PASSWORD_SET) {
      throw new ForbiddenException({
        message: 'PASSWORD_ALREADY_SET',
        code: 'PASSWORD_ALREADY_SET',
      });
    }

    user.passwordHash = newPassword;
    user.status = UserStatus.ACTIVE;

    const updatedUser = await this.userRepository.save(user);
    delete (updatedUser as any).passwordHash;
    return updatedUser;
  }

  async resetPassword(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    user.passwordHash = 'Merchant123!';
    user.status = UserStatus.PENDING_PASSWORD_SET;

    const updatedUser = await this.userRepository.save(user);
    delete (updatedUser as any).passwordHash;
    return updatedUser;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email?.toLowerCase().trim();
    return this.userRepository.findOne({ where: { email: normalizedEmail } });
  }

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 10, search, role } = paginationDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (search) {
      queryBuilder.andWhere(
        '(user.companyName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.skip(skip).take(limit).orderBy('user.createdAt', 'DESC');

    const [items, total] = await queryBuilder.getManyAndCount();

    items.forEach((item) => delete (item as any).passwordHash);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    delete (user as any).passwordHash;
    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    adminId?: string,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    if (updateUserDto.email) {
      updateUserDto.email = updateUserDto.email.toLowerCase().trim();
      if (updateUserDto.email !== user.email) {
        const existingUser = await this.userRepository.findOne({
          where: { email: updateUserDto.email },
        });

        if (existingUser) {
          throw new ConflictException('Email address is already in use');
        }
      }
    }

    const previousQuota = user.totalQuota;
    const { password, notes, ...updateData } = updateUserDto;
    if (password) {
      user.passwordHash = password;
    }

    Object.assign(user, updateData);
    const updatedUser = await this.userRepository.save(user);

    if (
      updateUserDto.totalQuota !== undefined &&
      updateUserDto.totalQuota !== previousQuota &&
      adminId
    ) {
      const diff = updateUserDto.totalQuota - previousQuota;
      await this.quotaLogRepository.save(
        this.quotaLogRepository.create({
          merchantId: user.id,
          adminId,
          amount: diff,
          notes: notes || 'Quota updated directly via user update',
        }),
      );
    }

    delete (updatedUser as any).passwordHash;
    return updatedUser;
  }

  async addQuota(
    merchantId: string,
    addQuotaDto: AddQuotaDto,
    adminId: string,
  ): Promise<{ merchant: User; log: QuotaLog }> {
    const merchant = await this.userRepository.findOne({
      where: { id: merchantId },
    });
    if (!merchant) {
      throw new NotFoundException(`Merchant with ID "${merchantId}" not found`);
    }

    const amountToAdd = addQuotaDto.amount;
    merchant.totalQuota = (merchant.totalQuota || 0) + amountToAdd;

    const savedMerchant = await this.userRepository.save(merchant);
    delete (savedMerchant as any).passwordHash;

    const quotaLog = this.quotaLogRepository.create({
      merchantId: merchant.id,
      adminId,
      amount: amountToAdd,
      notes: addQuotaDto.notes,
    });

    const savedLog = await this.quotaLogRepository.save(quotaLog);

    return { merchant: savedMerchant, log: savedLog };
  }

  async getQuotaLogs(merchantId: string): Promise<QuotaLog[]> {
    const merchant = await this.userRepository.findOne({
      where: { id: merchantId },
    });
    if (!merchant) {
      throw new NotFoundException(`Merchant with ID "${merchantId}" not found`);
    }

    return this.quotaLogRepository.find({
      where: { merchantId },
      relations: { admin: true },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    await this.userRepository.remove(user);
    return { message: `User with ID "${id}" has been deleted successfully` };
  }
}
