import { IsOptional, IsDateString, IsInt, IsNumber, IsString, IsEnum, Min } from 'class-validator';
import { ExpeditionStatus } from '../../domain/entities/expedition.entity';

export class UpdateExpeditionDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacityTotal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacityAvailable?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceAdult?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceChild?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(ExpeditionStatus)
  status?: ExpeditionStatus;
}
