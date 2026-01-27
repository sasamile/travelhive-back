import { IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

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

  @IsOptional()
  @IsString()
  promoterCode?: string; // Código del promoter usado para acceder al viaje

  @IsOptional()
  @IsUrl()
  redirectUrl?: string; // URL a la que Wompi redirige después del pago
}
