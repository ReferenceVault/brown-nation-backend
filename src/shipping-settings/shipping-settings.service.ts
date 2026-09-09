import { Injectable } from '@nestjs/common';
import { ShippingSettings } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { UpdateShippingSettingsDto } from './dto/update-shipping-settings.dto';

// Fixed id for the single settings row — seeded by the
// `add_shipping_settings` migration, never created at runtime.
const SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class ShippingSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<ShippingSettings> {
    return this.prisma.shippingSettings.findUniqueOrThrow({ where: { id: SINGLETON_ID } });
  }

  async update(dto: UpdateShippingSettingsDto): Promise<ShippingSettings> {
    return this.prisma.shippingSettings.update({
      where: { id: SINGLETON_ID },
      data: { flatFee: dto.flatFee, freeThreshold: dto.freeThreshold },
    });
  }
}
