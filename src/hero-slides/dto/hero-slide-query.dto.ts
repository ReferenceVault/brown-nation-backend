import { ApiPropertyOptional } from '@nestjs/swagger';
import { HeroSlideStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class HeroSlideQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: HeroSlideStatus })
  @IsOptional()
  @IsEnum(HeroSlideStatus)
  status?: HeroSlideStatus;
}
