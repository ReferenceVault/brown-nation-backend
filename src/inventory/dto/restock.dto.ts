import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class RestockDto {
  @ApiProperty({ example: 50 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity: number;
}
