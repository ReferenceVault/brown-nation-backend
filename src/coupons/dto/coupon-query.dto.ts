import { ApiPropertyOptional } from '@nestjs/swagger';
import { CouponStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CouponQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CouponStatus })
  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;

  @ApiPropertyOptional({ description: 'Case-insensitive search over the coupon code' })
  @IsOptional()
  @IsString()
  search?: string;
}
