import { IsOptional, IsString, IsInt, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class ListPublicTripsDto {
  @IsOptional()
  @IsString()
  origen?: string; // Nombre de la ciudad de origen (primer punto de ruta)
  
  @IsOptional()
  @IsString()
  destino?: string; // Nombre de la ciudad de destino (último punto de ruta o idCity)
  
  @IsOptional()
  @IsString()
  destination?: string; // ID de la ciudad (idCity) - mantiene compatibilidad

  @IsOptional()
  @IsDateString()
  startDate?: string; // Fecha de inicio (buscar en expeditions)

  @IsOptional()
  @IsDateString()
  endDate?: string; // Fecha de fin (buscar en expeditions)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  persons?: number; // Cantidad de personas (verificar capacityAvailable en expeditions)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
