import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  IsBoolean,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TripStatus,
  TripCategory,
  PriceType,
  Currency,
} from '../../domain/entities/trip.entity';
import {
  RoutePointDto,
  TripGalleryImageDto,
  ItineraryDayDto,
} from './create-trip.dto';

export class UpdateTripDto {
  @IsString()
  @IsOptional()
  idCity?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TripCategory)
  @IsOptional()
  category?: TripCategory;

  @IsString()
  @IsOptional()
  destinationRegion?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  durationDays?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  durationNights?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @IsEnum(PriceType)
  @IsOptional()
  priceType?: PriceType;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxPersons?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutePointDto)
  @IsOptional()
  routePoints?: RoutePointDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripGalleryImageDto)
  @IsOptional()
  galleryImages?: TripGalleryImageDto[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  coverImageIndex?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItineraryDayDto)
  @IsOptional()
  itinerary?: ItineraryDayDto[];

  @IsEnum(TripStatus)
  @IsOptional()
  status?: TripStatus;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
