import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { TripStatus } from '../../domain/entities/trip.entity';

export class CreateTripDto {
  @IsNumber()
  @IsNotEmpty()
  idAgency: number;

  @IsNumber()
  @IsNotEmpty()
  idCity: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsOptional()
  vibe?: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  durationDays: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  durationNights: number;

  @IsString()
  @IsOptional()
  coverImage?: string;

  @IsEnum(TripStatus)
  @IsOptional()
  status?: TripStatus;
}
