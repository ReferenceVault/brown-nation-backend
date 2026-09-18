import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class CreateRatingDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5, description: 'Star rating, 1-5' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;
}
