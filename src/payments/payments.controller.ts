import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RawResponse } from '../common/decorators/raw-response.decorator';
import { AuthenticatedUser } from '../common/types/auth.types';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth('access-token')
  @Post(':orderId/initiate')
  @ApiOperation({ summary: 'Initiate payment for an order' })
  async initiate(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.paymentsService.initiatePayment(user, orderId);
  }

  @ApiBearerAuth('access-token')
  @Post(':orderId/verify')
  @ApiOperation({ summary: "Verify a client-reported payment completion (e.g. Razorpay Checkout's success callback)" })
  async verify(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentsService.verifyPayment(user, orderId, {
      razorpay_order_id: dto.razorpay_order_id,
      razorpay_payment_id: dto.razorpay_payment_id,
      razorpay_signature: dto.razorpay_signature,
    });
  }

  @Public()
  @RawResponse()
  @HttpCode(HttpStatus.OK)
  @Post('webhook')
  @ApiOperation({ summary: 'Payment provider webhook endpoint (signature-verified)' })
  async webhook(@Req() request: RawBodyRequest<FastifyRequest>) {
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing request body');
    }

    const signature = request.headers[this.paymentsService.webhookSignatureHeader];
    try {
      await this.paymentsService.handleWebhook(
        rawBody,
        typeof signature === 'string' ? signature : undefined,
      );
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    return { received: true };
  }
}
