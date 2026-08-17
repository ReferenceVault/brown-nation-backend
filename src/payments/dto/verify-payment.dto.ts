import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/** Params returned by Razorpay Checkout's success handler, forwarded here for verification. */
export class VerifyPaymentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  razorpay_order_id: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  razorpay_payment_id: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  razorpay_signature: string;
}
