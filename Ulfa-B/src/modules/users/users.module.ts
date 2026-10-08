import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { QuotaLog } from './entities/quota-log.entity';
import { QuotaRequest } from './entities/quota-request.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { QuotaRequestsController } from './quota-requests.controller';
import { QuotaRequestsService } from './quota-requests.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, QuotaLog, QuotaRequest])],
  controllers: [UsersController, QuotaRequestsController],
  providers: [UsersService, QuotaRequestsService],
  exports: [UsersService],
})
export class UsersModule {}
