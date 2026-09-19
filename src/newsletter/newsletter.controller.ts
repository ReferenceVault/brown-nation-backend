import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';

import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { buildPaginatedResult } from '../common/utils/pagination.util';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { NewsletterService } from './newsletter.service';

const NEWSLETTER_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Public()
  @Throttle(NEWSLETTER_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe an email address to the newsletter' })
  async subscribe(@Body() dto: SubscribeNewsletterDto) {
    await this.newsletterService.subscribe(dto.email);
    return { message: "You're subscribed! Keep an eye on your inbox." };
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Get('subscribers')
  @ApiOperation({ summary: 'List newsletter subscribers (admin only)' })
  async listSubscribers(@Query() query: PaginationQueryDto) {
    const { items, total } = await this.newsletterService.list({
      skip: query.skip,
      take: query.take,
      sortOrder: query.sortOrder,
    });
    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Delete('subscribers/:id')
  @ApiOperation({ summary: 'Remove a newsletter subscriber (admin only)' })
  async removeSubscriber(@Param('id') id: string) {
    await this.newsletterService.remove(id);
    return { message: 'Subscriber removed successfully' };
  }
}
