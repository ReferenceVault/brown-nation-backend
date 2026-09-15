import { PartialType } from '@nestjs/swagger';

import { CreatePromoBannerDto } from './create-promo-banner.dto';

export class UpdatePromoBannerDto extends PartialType(CreatePromoBannerDto) {}
