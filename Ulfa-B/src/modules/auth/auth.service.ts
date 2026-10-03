import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async signUp(signUpDto: SignUpDto) {
    const {
      email,
      password,
      companyName,
    } = signUpDto;

    const normalizedEmail = email?.toLowerCase().trim();

    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('User with this email address already exists');
    }

    const user = this.userRepository.create({
      email: normalizedEmail,
      passwordHash: password, // Will be hashed automatically by User entity @BeforeInsert hook
      companyName,
      // Public registration can never grant privileged roles or quota.
      // Administrators create and configure merchants through UsersController.
      role: UserRole.MERCHANT,
      isUnlimitedQuota: false,
      totalQuota: 0,
      status: UserStatus.ACTIVE,
    });

    const savedUser = await this.userRepository.save(user);

    const payload: JwtPayload = {
      sub: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
    };

    const accessToken = this.jwtService.sign(payload);

    delete (savedUser as any).passwordHash;

    return {
      accessToken,
      user: savedUser,
    };
  }

  async signIn(signInDto: SignInDto) {
    const { email, password } = signInDto;
    const normalizedEmail = email?.toLowerCase().trim();

    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if account is inactive (Soft Delete / Suspended)
    if (user.status === UserStatus.INACTIVE) {
      throw new ForbiddenException('ACCOUNT_INACTIVE');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    delete (user as any).passwordHash;

    return {
      accessToken,
      user,
    };
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User profile not found');
    }
    delete (user as any).passwordHash;
    return user;
  }
}
