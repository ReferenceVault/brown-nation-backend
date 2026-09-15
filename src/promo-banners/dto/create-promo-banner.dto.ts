import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PromoBannerStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePromoBannerDto {
  @ApiProperty({ example: 'BIG CHOCOLATE SAVINGS' })
  @IsString()
  @MaxLength(100)
  eyebrow: string;

  @ApiProperty({ example: 'Get 15% OFF on your order' })
  @IsString()
  @MaxLength(150)
  heading: string;

  @ApiProperty({ example: 'Use code SWEET15 at checkout. Valid on all orders above ₹999.' })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiPropertyOptional({ example: 'SWEET15' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;

  @ApiPropertyOptional({ default: 'Shop Now' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ctaLabel?: string;

  @ApiPropertyOptional({ default: '/shop' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ctaHref?: string;

  @ApiPropertyOptional({ description: 'Image URL or local asset path' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;

  @ApiPropertyOptional({ default: 0, description: 'Lower numbers appear first' })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({ enum: PromoBannerStatus, default: PromoBannerStatus.ACTIVE })
  @IsOptional()
  @IsEnum(PromoBannerStatus)
  status?: PromoBannerStatus;
}
