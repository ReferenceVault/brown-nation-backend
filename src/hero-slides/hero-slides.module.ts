import { Module } from '@nestjs/common';

import { UploadsModule } from '../uploads/uploads.module';
import { HeroSlidesController } from './hero-slides.controller';
import { HeroSlidesService } from './hero-slides.service';

@Module({
  imports: [UploadsModule],
  controllers: [HeroSlidesController],
  providers: [HeroSlidesService],
})
export class HeroSlidesModule {}
