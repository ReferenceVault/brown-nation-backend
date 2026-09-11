import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { buildPaginatedResult } from '../common/utils/pagination.util';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementQueryDto } from './dto/announcement-query.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@ApiTags('announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List announcement bar entries' })
  async findAll(@Query() query: AnnouncementQueryDto) {
    const { items, total } = await this.announcementsService.findAll(query);
    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get an announcement by id' })
  async findOne(@Param('id') id: string) {
    return this.announcementsService.findOne(id);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create an announcement (admin only)' })
  async create(@Body() dto: CreateAnnouncementDto) {
    return this.announcementsService.create(dto);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update an announcement (admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.announcementsService.update(id, dto);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an announcement (admin only)' })
  async remove(@Param('id') id: string) {
    await this.announcementsService.remove(id);
    return { message: 'Announcement deleted successfully' };
  }
}
