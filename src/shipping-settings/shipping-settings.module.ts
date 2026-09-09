import { Module } from '@nestjs/common';

import { ShippingSettingsController } from './shipping-settings.controller';
import { ShippingSettingsService } from './shipping-settings.service';

@Module({
  controllers: [ShippingSettingsController],
  providers: [ShippingSettingsService],
  exports: [ShippingSettingsService],
})
export class ShippingSettingsModule {}
