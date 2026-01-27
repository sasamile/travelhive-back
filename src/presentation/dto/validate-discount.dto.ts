import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ValidateDiscountDto {
  @IsString()
  idTrip: string; // BigInt serializado

  @IsOptional()
  @IsDateString()
  startDate?: string; // Fecha de inicio del viaje (ISO string)

  @IsOptional()
  @IsDateString()
  endDate?: string; // Fecha de fin del viaje (ISO string)

  @IsInt()
  @Min(0)
  adults: number;

  @IsInt()
  @Min(0)
  children: number;

  @IsString()
  discountCode: string;
}

