import {
  IsString,
  IsNotEmpty,
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
  ActivityType,
  RoutePoint,
  TripGalleryImage,
  ItineraryDay,
  ItineraryActivity,
} from '../../domain/entities/trip.entity';

export class RoutePointDto implements RoutePoint {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsNumber()
  @Min(0)
  order: number;
}

export class TripGalleryImageDto implements TripGalleryImage {
  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @IsNumber()
  @Min(0)
  order: number;
}

export class ItineraryActivityDto implements ItineraryActivity {
  @IsEnum(ActivityType)
  @IsNotEmpty()
  type: ActivityType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  time?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  poiId?: string;

  @IsNumber()
  @Min(0)
  order: number;
}

export class ItineraryDayDto implements ItineraryDay {
  @IsNumber()
  @Min(1)
  day: number;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  subtitle?: string;

  @IsNumber()
  @Min(0)
  order: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItineraryActivityDto)
  activities: ItineraryActivityDto[];
}

export class CreateTripDto {
  @IsString()
  @IsOptional() // Opcional porque se obtiene de la sesión del usuario
  idAgency?: string;

  @IsString()
  @IsNotEmpty()
  idCity: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TripCategory)
  @IsNotEmpty()
  category: TripCategory;

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
  @IsNotEmpty()
  @Min(1)
  durationDays: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  durationNights: number;

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
