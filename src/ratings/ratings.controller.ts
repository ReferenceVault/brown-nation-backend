import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateRatingDto } from './dto/create-rating.dto';
import { RatingsService } from './ratings.service';

@ApiTags('ratings')
@ApiBearerAuth('access-token')
@Controller('products/:productId/ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @ApiOperation({ summary: 'Rate a purchased product (creates or updates your rating)' })
  async rate(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
    @Body() dto: CreateRatingDto,
  ) {
    return this.ratingsService.rate(userId, productId, dto.rating);
  }

  @Get('me')
  @ApiOperation({
    summary: "Get the current user's rating for a product, and whether they can rate it",
  })
  async getMine(@CurrentUser('id') userId: string, @Param('productId') productId: string) {
    return this.ratingsService.getMine(userId, productId);
  }
}
