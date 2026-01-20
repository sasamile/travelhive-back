import { IsDateString, IsNumber, IsNotEmpty, IsOptional, IsString, IsEnum, Min } from 'class-validator';
import { ExpeditionStatus } from '../../domain/entities/expedition.entity';

export class CreateExpeditionDto {
  @IsNumber()
  @IsNotEmpty()
  idTrip: number;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  capacityTotal: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  capacityAvailable?: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  priceAdult: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  priceChild?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsEnum(ExpeditionStatus)
  @IsOptional()
  status?: ExpeditionStatus;
}
