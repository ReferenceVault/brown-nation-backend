import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { buildPaginatedResult } from '../common/utils/pagination.util';
import { CreatePromoBannerDto } from './dto/create-promo-banner.dto';
import { PromoBannerQueryDto } from './dto/promo-banner-query.dto';
import { UpdatePromoBannerDto } from './dto/update-promo-banner.dto';
import { PromoBannersService } from './promo-banners.service';

@ApiTags('promo-banners')
@Controller('promo-banners')
export class PromoBannersController {
  constructor(private readonly promoBannersService: PromoBannersService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List promotional banners' })
  async findAll(@Query() query: PromoBannerQueryDto) {
    const { items, total } = await this.promoBannersService.findAll(query);
    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a promo banner by id' })
  async findOne(@Param('id') id: string) {
    return this.promoBannersService.findOne(id);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a promo banner (admin only)' })
  async create(@Body() dto: CreatePromoBannerDto) {
    return this.promoBannersService.create(dto);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a promo banner (admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdatePromoBannerDto) {
    return this.promoBannersService.update(id, dto);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a promo banner (admin only)' })
  async remove(@Param('id') id: string) {
    await this.promoBannersService.remove(id);
    return { message: 'Promo banner deleted successfully' };
  }
}
