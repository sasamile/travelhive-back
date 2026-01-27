import { IsOptional, IsDateString } from 'class-validator';

export class GetAgencyInsightsDto {
  @IsOptional()
  @IsDateString()
  startDate?: string; // Fecha de inicio del rango (ISO string)

  @IsOptional()
  @IsDateString()
  endDate?: string; // Fecha de fin del rango (ISO string)
}
