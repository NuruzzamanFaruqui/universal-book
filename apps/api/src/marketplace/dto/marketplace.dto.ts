import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PublishBookDto {
  // A negative price previously reached _completePurchase and *increased* the
  // buyer's balance — buy your own listing at -100 and mint credits.
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Price must be a number with at most 2 decimals.' })
  @Min(0, { message: 'Price cannot be negative.' })
  @Max(9999, { message: 'Price cannot exceed $9,999.' })
  price: number;
}

export class AddReviewDto {
  @IsInt()
  @Min(1, { message: 'Rating must be between 1 and 5.' })
  @Max(5, { message: 'Rating must be between 1 and 5.' })
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
