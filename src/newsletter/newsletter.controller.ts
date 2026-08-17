import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../common/decorators/public.decorator';
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
}
