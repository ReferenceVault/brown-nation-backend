import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HeroSlideStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateHeroSlideDto {
  @ApiProperty({ example: 'Handcrafted. Heartfelt. Unforgettable.' })
  @IsString()
  @MaxLength(150)
  eyebrow: string;

  @ApiProperty({ example: 'Every Bite,' })
  @IsString()
  @MaxLength(100)
  headingLine1: string;

  @ApiProperty({ example: 'A Moment of Joy' })
  @IsString()
  @MaxLength(100)
  headingLine2: string;

  @ApiProperty({ example: 'Indulge in handcrafted chocolates made with premium ingredients.' })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiPropertyOptional({ default: 'Shop Now' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  primaryCtaLabel?: string;

  @ApiPropertyOptional({ default: '/shop' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  primaryCtaHref?: string;

  @ApiPropertyOptional({ default: 'Explore Flavors' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  secondaryCtaLabel?: string;

  @ApiPropertyOptional({ default: '/shop' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  secondaryCtaHref?: string;

  @ApiProperty({ description: 'Image URL or local asset path' })
  @IsString()
  @MaxLength(500)
  image: string;

  @ApiPropertyOptional({ default: '#f8ece5' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  paletteFrom?: string;

  @ApiPropertyOptional({ default: '#eddcd0' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  paletteTo?: string;

  @ApiPropertyOptional({ default: 0, description: 'Lower numbers appear first' })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({ enum: HeroSlideStatus, default: HeroSlideStatus.ACTIVE })
  @IsOptional()
  @IsEnum(HeroSlideStatus)
  status?: HeroSlideStatus;
}
