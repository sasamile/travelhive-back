import { IsOptional, IsString, IsEnum, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum BookingStatusFilter {
  ALL = 'all',
  CONFIRMED = 'confirmed',
  PENDING = 'pending',
  CANCELLED = 'canceled',
}

export class ListAgencyBookingsDto {
  @IsOptional()
  @IsEnum(BookingStatusFilter)
  status?: BookingStatusFilter; // 'all' | 'confirmed' | 'pending' | 'canceled'

  @IsOptional()
  @IsString()
  search?: string; // Buscar por ID de reserva, nombre del viajero o email

  @IsOptional()
  @IsDateString()
  startDate?: string; // Fecha de inicio del rango (ISO string)

  @IsOptional()
  @IsDateString()
  endDate?: string; // Fecha de fin del rango (ISO string)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number; // Página (por defecto: 1)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number; // Límite por página (por defecto: 20)
}
