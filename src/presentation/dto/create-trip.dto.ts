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

  // Códigos de descuento para el viaje
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscountCodeDto)
  @IsOptional()
  discountCodes?: DiscountCodeDto[];

  // Promoter/Influencer asociado
  @IsString()
  @IsOptional()
  promoterCode?: string; // Código del promoter (si existe)

  @IsString()
  @IsOptional()
  promoterName?: string; // Nombre del promoter (si se crea uno nuevo)
}

export class DiscountCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string; // Nombre del código (ej: "SUMMER2024")

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  percentage: number; // Porcentaje de descuento (ej: 10 para 10%)

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxUses?: number; // Máximo número de usos (opcional)

  @IsNumber()
  @IsOptional()
  @Min(1)
  perUserLimit?: number; // Límite de usos por usuario (opcional)
}
