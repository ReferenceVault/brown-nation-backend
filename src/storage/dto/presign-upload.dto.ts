import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';

import { ALLOWED_IMAGE_MIME_TYPES } from '../../common/constants/allowed-image-mime-types.constant';

export class PresignUploadDto {
  @ApiProperty({ example: 'product-photo.jpg' })
  @IsString()
  @MaxLength(255)
  filename: string;

  @ApiProperty({ enum: ALLOWED_IMAGE_MIME_TYPES })
  @IsString()
  @IsIn(ALLOWED_IMAGE_MIME_TYPES)
  contentType: string;
}
