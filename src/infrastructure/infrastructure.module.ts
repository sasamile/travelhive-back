import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { UserRepository } from './repositories/user.repository';
import { AgencyRepository, AgencyMemberRepository } from './repositories/agency.repository';
import { TripRepository } from './repositories/trip.repository';
import { ExpeditionRepository } from './repositories/expedition.repository';
import { BookingRepository } from './repositories/booking.repository';
import {
  USER_REPOSITORY,
  AGENCY_REPOSITORY,
  AGENCY_MEMBER_REPOSITORY,
  TRIP_REPOSITORY,
  EXPEDITION_REPOSITORY,
  BOOKING_REPOSITORY,
} from '../domain/ports/tokens';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: AGENCY_REPOSITORY,
      useClass: AgencyRepository,
    },
    {
      provide: AGENCY_MEMBER_REPOSITORY,
      useClass: AgencyMemberRepository,
    },
    {
      provide: TRIP_REPOSITORY,
      useClass: TripRepository,
    },
    {
      provide: EXPEDITION_REPOSITORY,
      useClass: ExpeditionRepository,
    },
    {
      provide: BOOKING_REPOSITORY,
      useClass: BookingRepository,
    },
  ],
  exports: [
    USER_REPOSITORY,
    AGENCY_REPOSITORY,
    AGENCY_MEMBER_REPOSITORY,
    TRIP_REPOSITORY,
    EXPEDITION_REPOSITORY,
    BOOKING_REPOSITORY,
  ],
})
export class InfrastructureModule {}
