import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';

import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { buildPaginatedResult } from '../common/utils/pagination.util';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { EnquiryQueryDto } from './dto/enquiry-query.dto';
import { UpdateEnquiryDto } from './dto/update-enquiry.dto';
import { EnquiriesService } from './enquiries.service';

const ENQUIRY_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('enquiries')
@Controller('enquiries')
export class EnquiriesController {
  constructor(private readonly enquiriesService: EnquiriesService) {}

  @Public()
  @Throttle(ENQUIRY_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post()
  @ApiOperation({ summary: 'Submit a contact form enquiry' })
  async create(@Body() dto: CreateEnquiryDto) {
    await this.enquiriesService.create(dto);
    return { message: "Thanks for reaching out! We'll get back to you soon." };
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'List contact form enquiries (admin only)' })
  async findAll(@Query() query: EnquiryQueryDto) {
    const { items, total } = await this.enquiriesService.findAll(query);
    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Get an enquiry by id (admin only)' })
  async findOne(@Param('id') id: string) {
    return this.enquiriesService.findOne(id);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update an enquiry status (admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateEnquiryDto) {
    return this.enquiriesService.update(id, dto);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an enquiry (admin only)' })
  async remove(@Param('id') id: string) {
    await this.enquiriesService.remove(id);
    return { message: 'Enquiry deleted successfully' };
  }
}
