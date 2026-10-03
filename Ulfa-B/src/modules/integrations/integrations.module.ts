import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { IntegrationApiKey } from './entities/integration-api-key.entity';
import { ApiKeyGuard } from './guards/api-key.guard';
import { IntegrationApiKeysService } from './integration-api-keys.service';
import {
  IntegrationApiKeysController,
  IntegrationOrdersController,
} from './integrations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationApiKey]),
    AuthModule,
    OrdersModule,
  ],
  controllers: [IntegrationApiKeysController, IntegrationOrdersController],
  providers: [IntegrationApiKeysService, ApiKeyGuard],
})
export class IntegrationsModule {}

