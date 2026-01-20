import { IsString, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { TripStatus } from '../../domain/entities/trip.entity';

export class UpdateTripDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  vibe?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  durationDays?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  durationNights?: number;

  @IsString()
  @IsOptional()
  coverImage?: string;

  @IsEnum(TripStatus)
  @IsOptional()
  status?: TripStatus;

  @IsNumber()
  @IsOptional()
  idCity?: number;
}
