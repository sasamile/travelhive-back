import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  idTrip: string; // BigInt serializado

  @IsString()
  idExpedition: string; // BigInt serializado

  @IsInt()
  @Min(0)
  adults: number;

  @IsInt()
  @Min(0)
  children: number;

  @IsOptional()
  @IsString()
  discountCode?: string;
}
