import { ApiProperty } from '@nestjs/swagger';
import { EnquiryStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateEnquiryDto {
  @ApiProperty({ enum: EnquiryStatus })
  @IsEnum(EnquiryStatus)
  status: EnquiryStatus;
}
