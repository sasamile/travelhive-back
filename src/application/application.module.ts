import { Module } from '@nestjs/common';
import { RegisterAgencyUseCase } from './use-cases/auth/register-use-case';
import { LoginUseCase } from './use-cases/auth/login-use-case';
import { ApproveAgencyUseCase } from './use-cases/agency/approve-agency-use-case';
import { ListPendingAgenciesUseCase } from './use-cases/agency/list-pending-agencies-use-case';
import { CreateTripUseCase } from './use-cases/trip/create-trip-use-case';
import { ListTripsUseCase } from './use-cases/trip/list-trips-use-case';
import { GetTripByIdUseCase } from './use-cases/trip/get-trip-by-id-use-case';
import { UpdateTripUseCase } from './use-cases/trip/update-trip-use-case';
import { DeleteTripUseCase } from './use-cases/trip/delete-trip-use-case';
import { ChangeTripStatusUseCase } from './use-cases/trip/change-trip-status-use-case';
import { ToggleTripActiveUseCase } from './use-cases/trip/toggle-trip-active-use-case';
import { CreateExpeditionUseCase } from './use-cases/expedition/create-expedition-use-case';
import { ListExpeditionsUseCase } from './use-cases/expedition/list-expeditions-use-case';
import { ListAgencyExpeditionsUseCase } from './use-cases/expedition/list-agency-expeditions-use-case';
import { UpdateUserProfileUseCase } from './use-cases/user/update-user-profile-use-case';
import { UpdateAgencyUseCase } from './use-cases/agency/update-agency-use-case';
import { CreateBookingUseCase } from './use-cases/booking/create-booking-use-case';
import { ListMyBookingsUseCase } from './use-cases/booking/list-my-bookings-use-case';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';

@Module({
  imports: [InfrastructureModule],
  providers: [
    RegisterAgencyUseCase,
    LoginUseCase,
    ApproveAgencyUseCase,
    ListPendingAgenciesUseCase,
    CreateTripUseCase,
    ListTripsUseCase,
    GetTripByIdUseCase,
    UpdateTripUseCase,
    DeleteTripUseCase,
    ChangeTripStatusUseCase,
    ToggleTripActiveUseCase,
    CreateExpeditionUseCase,
    ListExpeditionsUseCase,
    ListAgencyExpeditionsUseCase,
    UpdateUserProfileUseCase,
    UpdateAgencyUseCase,
    CreateBookingUseCase,
    ListMyBookingsUseCase,
  ],
  exports: [
    RegisterAgencyUseCase,
    LoginUseCase,
    ApproveAgencyUseCase,
    ListPendingAgenciesUseCase,
    CreateTripUseCase,
    ListTripsUseCase,
    GetTripByIdUseCase,
    UpdateTripUseCase,
    DeleteTripUseCase,
    ChangeTripStatusUseCase,
    ToggleTripActiveUseCase,
    CreateExpeditionUseCase,
    ListExpeditionsUseCase,
    ListAgencyExpeditionsUseCase,
    UpdateUserProfileUseCase,
    UpdateAgencyUseCase,
    CreateBookingUseCase,
    ListMyBookingsUseCase,
  ],
})
export class ApplicationModule {}
