import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class UpdateShippingSettingsDto {
  @ApiProperty({
    example: 49,
    description: 'Flat shipping fee charged below the free-shipping threshold',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  flatFee: number;

  @ApiProperty({ example: 999, description: 'Order subtotal at or above which shipping is free' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  freeThreshold: number;
}
