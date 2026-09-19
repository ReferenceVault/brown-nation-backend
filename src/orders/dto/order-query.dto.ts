import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class OrderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description:
      'Scope to the requester\'s own orders even when they are an admin — the customer-facing "My Orders" list always sets this, so an admin browsing their own account never sees every order in the system.',
  })
  @IsOptional()
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj.mine === true || obj.mine === 'true')
  @IsBoolean()
  mine?: boolean;
}
