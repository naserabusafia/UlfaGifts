import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { NfcItem } from '../nfc-items/entities/nfc-item.entity';
import { AuthModule } from '../auth/auth.module';
import { Order } from './entities/order.entity';
import {
  MerchantOrdersController,
  OrdersController,
} from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, User, NfcItem]),
    UsersModule,
    AuthModule,
  ],
  controllers: [OrdersController, MerchantOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
