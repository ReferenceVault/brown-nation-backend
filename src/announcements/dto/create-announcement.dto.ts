import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnnouncementStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty({ example: '🍫 Get 15% OFF on orders above ₹999 | Use code SWEET15' })
  @IsString()
  @MaxLength(200)
  text: string;

  @ApiPropertyOptional({ example: 'Shop Now →' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  linkLabel?: string;

  @ApiPropertyOptional({ example: '/shop' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  linkHref?: string;

  @ApiPropertyOptional({ default: 0, description: 'Lower numbers appear first' })
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional({ enum: AnnouncementStatus, default: AnnouncementStatus.ACTIVE })
  @IsOptional()
  @IsEnum(AnnouncementStatus)
  status?: AnnouncementStatus;
}
