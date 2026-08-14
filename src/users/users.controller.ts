import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { buildPaginatedResult } from '../common/utils/pagination.util';
import { AuthenticatedUser } from '../common/types/auth.types';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { DeleteUserQueryDto } from './dto/delete-user-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List users (admin only)' })
  async list(@Query() query: UserQueryDto) {
    const { items, total } = await this.usersService.list({
      skip: query.skip,
      take: query.take,
      role: query.role,
    });
    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  async updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id (self or admin)' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    if (user.role !== UserRole.ADMIN && user.id !== id) {
      throw new ForbiddenException('You may only access your own account');
    }
    return this.usersService.findSafeById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Update a user's role and/or status (admin only)" })
  async updateAdmin(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: AdminUpdateUserDto,
  ) {
    if (id === admin.id && (dto.role || dto.status)) {
      throw new BadRequestException('Admins cannot change their own role or status');
    }
    return this.usersService.updateAdmin(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a user, optionally deleting their orders too (admin only)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Query() query: DeleteUserQueryDto,
  ) {
    if (id === admin.id) {
      throw new BadRequestException('Admins cannot delete their own account');
    }
    await this.usersService.deleteUser(id, query.deleteOrders ?? false);
    return { message: 'User deleted successfully' };
  }
}
