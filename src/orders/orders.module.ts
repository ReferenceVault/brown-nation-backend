import { Module } from '@nestjs/common';

import { EmailModule } from '../email/email.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ShippingSettingsModule } from '../shipping-settings/shipping-settings.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [InventoryModule, EmailModule, ShippingSettingsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
