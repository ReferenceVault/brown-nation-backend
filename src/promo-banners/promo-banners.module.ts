import { Module } from '@nestjs/common';

import { UploadsModule } from '../uploads/uploads.module';
import { PromoBannersController } from './promo-banners.controller';
import { PromoBannersService } from './promo-banners.service';

@Module({
  imports: [UploadsModule],
  controllers: [PromoBannersController],
  providers: [PromoBannersService],
})
export class PromoBannersModule {}
