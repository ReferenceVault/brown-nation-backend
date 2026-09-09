import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateShippingSettingsDto } from './dto/update-shipping-settings.dto';
import { ShippingSettingsService } from './shipping-settings.service';

@ApiTags('shipping-settings')
@Controller('shipping-settings')
export class ShippingSettingsController {
  constructor(private readonly shippingSettingsService: ShippingSettingsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get the current shipping fee and free-shipping threshold' })
  async get() {
    return this.shippingSettingsService.get();
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Patch()
  @ApiOperation({ summary: 'Update the shipping fee and free-shipping threshold (admin only)' })
  async update(@Body() dto: UpdateShippingSettingsDto) {
    return this.shippingSettingsService.update(dto);
  }
}
