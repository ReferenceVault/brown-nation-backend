import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

import { ShippingAddressDto } from './shipping-address.dto';

export class CreateOrderDto {
  @ApiProperty({ type: ShippingAddressDto })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @ApiPropertyOptional({
    type: ShippingAddressDto,
    description: 'Defaults to shippingAddress if omitted',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  billingAddress?: ShippingAddressDto;

  @ApiPropertyOptional({ example: 'SWEET15', description: 'Coupon code to apply to this order' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;
}
