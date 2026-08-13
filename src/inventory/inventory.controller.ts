import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { Roles } from '../common/decorators/roles.decorator';
import { RestockDto } from './dto/restock.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth('access-token')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Roles(UserRole.ADMIN)
  @Post(':productId/restock')
  @ApiOperation({ summary: 'Add stock to a product (admin only)' })
  async restock(@Param('productId') productId: string, @Body() dto: RestockDto) {
    await this.inventoryService.restock(productId, dto.quantity);
    return { message: 'Stock updated successfully' };
  }
}
