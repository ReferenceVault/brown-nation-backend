import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsUrl,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Assam Gold Loose Leaf Tea' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'URL-friendly identifier; derived from name if omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(220)
  slug?: string;

  @ApiProperty({ example: 'A robust, malty black tea from the Assam region.' })
  @IsString()
  @MaxLength(5000)
  description: string;

  @ApiProperty({ example: 499.0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @ApiPropertyOptional({ example: 599.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  compareAtPrice?: number;

  @ApiProperty({ example: 'TEA-ASM-001' })
  @IsString()
  @MaxLength(64)
  sku: string;

  @ApiPropertyOptional({ type: [String], description: 'Image URLs' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ require_tld: false }, { each: true })
  images?: string[];

  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.DRAFT })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ example: 100, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(
    ({ obj }: { obj: Record<string, unknown> }) =>
      obj.isBestSeller === true || obj.isBestSeller === 'true',
  )
  @IsBoolean()
  isBestSeller?: boolean;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Minimum quantity a customer can order',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minOrderQuantity?: number;
}
