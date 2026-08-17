import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { buildPaginatedResult } from '../common/utils/pagination.util';
import { CreateHeroSlideDto } from './dto/create-hero-slide.dto';
import { HeroSlideQueryDto } from './dto/hero-slide-query.dto';
import { UpdateHeroSlideDto } from './dto/update-hero-slide.dto';
import { HeroSlidesService } from './hero-slides.service';

@ApiTags('hero-slides')
@Controller('hero-slides')
export class HeroSlidesController {
  constructor(private readonly heroSlidesService: HeroSlidesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List homepage hero slides' })
  async findAll(@Query() query: HeroSlideQueryDto) {
    const { items, total } = await this.heroSlidesService.findAll(query);
    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a hero slide by id' })
  async findOne(@Param('id') id: string) {
    return this.heroSlidesService.findOne(id);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a hero slide (admin only)' })
  async create(@Body() dto: CreateHeroSlideDto) {
    return this.heroSlidesService.create(dto);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a hero slide (admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateHeroSlideDto) {
    return this.heroSlidesService.update(id, dto);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a hero slide (admin only)' })
  async remove(@Param('id') id: string) {
    await this.heroSlidesService.remove(id);
    return { message: 'Hero slide deleted successfully' };
  }
}
