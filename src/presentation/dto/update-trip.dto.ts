import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsNotEmpty,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TripStatus,
  TripType,
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

  @IsString()
  @IsOptional()
  location?: string; // Lugar/ubicación específica

  @IsEnum(TripType)
  @IsOptional()
  type?: TripType; // Tipo: TRIP o EXPERIENCE

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
