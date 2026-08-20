import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Full-text search across name and description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: [...Object.values(ProductStatus), 'ALL'],
    default: ProductStatus.ACTIVE,
    description:
      'Defaults to ACTIVE (public storefront behavior); pass ALL to skip the filter (admin use)',
  })
  @IsOptional()
  @IsIn([...Object.values(ProductStatus), 'ALL'])
  status?: ProductStatus | 'ALL';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  maxPrice?: number;

  @ApiPropertyOptional({
    enum: ['name', 'price', 'createdAt', 'stockQuantity'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['name', 'price', 'createdAt', 'stockQuantity'])
  sortBy?: 'name' | 'price' | 'createdAt' | 'stockQuantity' = 'createdAt';

  @ApiPropertyOptional({ description: 'Filter to only best-seller products' })
  @IsOptional()
  @Transform(
    ({ obj }: { obj: Record<string, unknown> }) =>
      obj.isBestSeller === true || obj.isBestSeller === 'true',
  )
  @IsBoolean()
  isBestSeller?: boolean;
}
