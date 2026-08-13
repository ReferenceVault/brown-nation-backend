import { Controller, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { FastifyRequest } from 'fastify';

import { Roles } from '../common/decorators/roles.decorator';
import { UploadsService } from './uploads.service';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Post(':folder')
  @ApiOperation({ summary: 'Upload an image file to local storage (admin only)' })
  @ApiParam({ name: 'folder', enum: ['products', 'categories'] })
  async upload(@Param('folder') folder: string, @Req() request: FastifyRequest) {
    return this.uploadsService.uploadImage(folder, request);
  }
}
