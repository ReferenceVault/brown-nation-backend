import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class DeleteUserQueryDto {
  @ApiPropertyOptional({
    description: 'If true, also delete the orders placed by this user. Otherwise orders are kept and unlinked.',
    default: false,
  })
  @IsOptional()
  @Transform(({ obj }) => obj.deleteOrders === true || obj.deleteOrders === 'true')
  @IsBoolean()
  deleteOrders?: boolean;
}
