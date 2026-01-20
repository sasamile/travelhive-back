import { Module } from '@nestjs/common';
import { RegisterAgencyUseCase } from './use-cases/auth/register-use-case';
import { LoginUseCase } from './use-cases/auth/login-use-case';
import { ApproveAgencyUseCase } from './use-cases/agency/approve-agency-use-case';
import { ListPendingAgenciesUseCase } from './use-cases/agency/list-pending-agencies-use-case';
import { CreateTripUseCase } from './use-cases/trip/create-trip-use-case';
import { ListTripsUseCase } from './use-cases/trip/list-trips-use-case';
import { UpdateTripUseCase } from './use-cases/trip/update-trip-use-case';
import { DeleteTripUseCase } from './use-cases/trip/delete-trip-use-case';
import { CreateExpeditionUseCase } from './use-cases/expedition/create-expedition-use-case';
import { ListExpeditionsUseCase } from './use-cases/expedition/list-expeditions-use-case';
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
    UpdateTripUseCase,
    DeleteTripUseCase,
    CreateExpeditionUseCase,
    ListExpeditionsUseCase,
  ],
  exports: [
    RegisterAgencyUseCase,
    LoginUseCase,
    ApproveAgencyUseCase,
    ListPendingAgenciesUseCase,
    CreateTripUseCase,
    ListTripsUseCase,
    UpdateTripUseCase,
    DeleteTripUseCase,
    CreateExpeditionUseCase,
    ListExpeditionsUseCase,
  ],
})
export class ApplicationModule {}
