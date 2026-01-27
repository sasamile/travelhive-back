import { IsOptional, IsString, IsEnum } from 'class-validator';

export enum BookingFilterType {
  ALL = 'all',
  UPCOMING = 'upcoming',
  HISTORY = 'history',
}

export class ListMyBookingsDto {
  @IsOptional()
  @IsEnum(BookingFilterType)
  filter?: BookingFilterType; // 'all' | 'upcoming' | 'history'

  @IsOptional()
  @IsString()
  search?: string; // Buscar por nombre del viaje
}
