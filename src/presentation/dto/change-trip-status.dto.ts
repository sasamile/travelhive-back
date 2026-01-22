import { IsEnum } from 'class-validator';
import { TripStatus } from '../../domain/entities/trip.entity';

export class ChangeTripStatusDto {
  @IsEnum(TripStatus, {
    message: 'El estado debe ser uno de: DRAFT, PUBLISHED, ARCHIVED',
  })
  status: TripStatus;
}
