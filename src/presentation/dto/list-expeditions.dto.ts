import { IsOptional, IsEnum, IsInt, Min, Max, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum ExpeditionFilterStatus {
  ACTIVE = 'active',
  DRAFTS = 'drafts',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export class ListExpeditionsDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string; // Filtro por nombre/título del trip

  @IsOptional()
  @IsDateString()
  date?: string; // Filtro por fecha (buscará en startDate y endDate de expediciones)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
