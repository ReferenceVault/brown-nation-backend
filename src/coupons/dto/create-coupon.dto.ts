import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CouponDiscountType, CouponStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCouponDto {
  @ApiProperty({ example: 'SWEET15' })
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Coupon code may only contain letters, numbers, hyphens and underscores',
  })
  code: string;

  @ApiProperty({ enum: CouponDiscountType, example: CouponDiscountType.PERCENTAGE })
  @IsEnum(CouponDiscountType)
  discountType: CouponDiscountType;

  @ApiProperty({ example: 15, description: 'Percentage (0-100) or a flat currency amount' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  discountValue: number;

  @ApiPropertyOptional({ example: 999, description: 'Minimum cart subtotal required to apply' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({
    example: 200,
    description: 'Caps the computed discount for PERCENTAGE coupons',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  maxDiscountAmount?: number;

  @ApiPropertyOptional({
    description: 'Coupon becomes usable from this date; omit for immediately',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'Coupon stops working after this date; omit for never' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    example: 100,
    description: 'Total redemptions allowed; omit for unlimited',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Redemptions allowed per customer; omit for unlimited',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perCustomerLimit?: number;

  @ApiPropertyOptional({ enum: CouponStatus, default: CouponStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;

  @ApiPropertyOptional({
    type: [String],
    description: 'Category ids this coupon is restricted to; empty means store-wide',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  applicableCategoryIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Product ids this coupon is restricted to; empty means store-wide',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  applicableProductIds?: string[];
}
