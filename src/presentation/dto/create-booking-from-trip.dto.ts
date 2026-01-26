import { IsInt, IsOptional, IsString, IsUrl, IsDateString, Min } from 'class-validator';

export class CreateBookingFromTripDto {
  @IsString()
  idTrip: string; // BigInt serializado

  @IsDateString()
  startDate: string; // Fecha de inicio del viaje (ISO string)

  @IsDateString()
  endDate: string; // Fecha de fin del viaje (ISO string)

  @IsInt()
  @Min(0)
  adults: number;

  @IsInt()
  @Min(0)
  children: number;

  @IsOptional()
  @IsString()
  discountCode?: string;

  @IsOptional()
  @IsUrl()
  redirectUrl?: string; // URL a la que Wompi redirige después del pago
}
