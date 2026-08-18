import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class CreateEnquiryDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'Do you offer custom gift boxes for weddings?' })
  @IsString()
  @MaxLength(2000)
  message: string;
}
