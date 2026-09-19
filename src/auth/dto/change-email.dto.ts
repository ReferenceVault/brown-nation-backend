import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ChangeEmailDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;
}
