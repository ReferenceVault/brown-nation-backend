import { Module } from '@nestjs/common';

import { PromoBannersController } from './promo-banners.controller';
import { PromoBannersService } from './promo-banners.service';

@Module({
  controllers: [PromoBannersController],
  providers: [PromoBannersService],
})
export class PromoBannersModule {}
