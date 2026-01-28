import { Module } from '@nestjs/common';
import { RegisterAgencyUseCase } from './use-cases/auth/register-use-case';
import { RegisterHostUseCase } from './use-cases/auth/register-host-use-case';
import { LoginUseCase } from './use-cases/auth/login-use-case';
import { ApproveAgencyUseCase } from './use-cases/agency/approve-agency-use-case';
import { ListPendingAgenciesUseCase } from './use-cases/agency/list-pending-agencies-use-case';
import { CreateTripUseCase } from './use-cases/trip/create-trip-use-case';
import { ListTripsUseCase } from './use-cases/trip/list-trips-use-case';
import { ListPublicTripsUseCase } from './use-cases/trip/list-public-trips-use-case';
import { GetPublicTripByIdUseCase } from './use-cases/trip/get-public-trip-by-id-use-case';
import { GetTripByIdUseCase } from './use-cases/trip/get-trip-by-id-use-case';
import { GetTripStatsUseCase } from './use-cases/trip/get-trip-stats-use-case';
import { UpdateTripUseCase } from './use-cases/trip/update-trip-use-case';
import { DeleteTripUseCase } from './use-cases/trip/delete-trip-use-case';
import { ChangeTripStatusUseCase } from './use-cases/trip/change-trip-status-use-case';
import { ToggleTripActiveUseCase } from './use-cases/trip/toggle-trip-active-use-case';
import { CreateExpeditionUseCase } from './use-cases/expedition/create-expedition-use-case';
import { ListExpeditionsUseCase } from './use-cases/expedition/list-expeditions-use-case';
import { ListAgencyExpeditionsUseCase } from './use-cases/expedition/list-agency-expeditions-use-case';
import { UpdateExpeditionUseCase } from './use-cases/expedition/update-expedition-use-case';
import { DeleteExpeditionUseCase } from './use-cases/expedition/delete-expedition-use-case';
import { UpdateUserProfileUseCase } from './use-cases/user/update-user-profile-use-case';
import { ChangePasswordUseCase } from './use-cases/user/change-password-use-case';
import { UpdateAgencyUseCase } from './use-cases/agency/update-agency-use-case';
import { CreateAgencyMemberUseCase } from './use-cases/agency/create-agency-member-use-case';
import { UpdateAgencyMemberUseCase } from './use-cases/agency/update-agency-member-use-case';
import { DeleteAgencyMemberUseCase } from './use-cases/agency/delete-agency-member-use-case';
import { ToggleAgencyMemberActiveUseCase } from './use-cases/agency/toggle-agency-member-active-use-case';
import { ActivateAgencyMemberUseCase } from './use-cases/agency/activate-agency-member-use-case';
import { DeactivateAgencyMemberUseCase } from './use-cases/agency/deactivate-agency-member-use-case';
import { ChangeAgencyMemberPasswordUseCase } from './use-cases/agency/change-agency-member-password-use-case';
import { ListAgencyMembersUseCase } from './use-cases/agency/list-agency-members-use-case';
import { GetAgencyInsightsUseCase } from './use-cases/agency/get-agency-insights-use-case';
import { CreateBookingUseCase } from './use-cases/booking/create-booking-use-case';
import { CreateBookingFromTripUseCase } from './use-cases/booking/create-booking-from-trip-use-case';
import { ListMyBookingsUseCase } from './use-cases/booking/list-my-bookings-use-case';
import { ListAgencyBookingsUseCase } from './use-cases/booking/list-agency-bookings-use-case';
import { UpdateBookingPaymentUseCase } from './use-cases/booking/update-booking-payment-use-case';
import { CancelPendingBookingUseCase } from './use-cases/booking/cancel-pending-booking-use-case';
import { ValidateDiscountForTripUseCase } from './use-cases/booking/validate-discount-for-trip-use-case';
import { RegisterPromoterViewUseCase } from './use-cases/promoter/register-promoter-view-use-case';
import { ToggleTripFavoriteUseCase } from './use-cases/trip-favorite/toggle-trip-favorite-use-case';
import { ListMyFavoritesUseCase } from './use-cases/trip-favorite/list-my-favorites-use-case';
import { CreateTripReviewUseCase } from './use-cases/trip-review/create-trip-review-use-case';
import { UpdateTripReviewUseCase } from './use-cases/trip-review/update-trip-review-use-case';
import { DeleteTripReviewUseCase } from './use-cases/trip-review/delete-trip-review-use-case';
import { ListTripReviewsUseCase } from './use-cases/trip-review/list-trip-reviews-use-case';
import { BookingCleanupService } from './services/booking-cleanup.service';
import { ExpeditionStatusUpdateService } from './services/expedition-status-update.service';
import { QRCodeService } from './services/qr-code.service';
import { CreateSuperAdminUseCase } from './use-cases/admin/create-super-admin-use-case';
import { CreateFirstSuperAdminUseCase } from './use-cases/admin/create-first-super-admin-use-case';
import { ListAllAgenciesUseCase } from './use-cases/admin/list-all-agencies-use-case';
import { ListPendingHostsUseCase } from './use-cases/admin/list-pending-hosts-use-case';
import { ApproveHostUseCase } from './use-cases/admin/approve-host-use-case';
import { GetAdminMetricsUseCase } from './use-cases/admin/get-admin-metrics-use-case';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { PaymentsModule } from '../config/payments/payments.module';

@Module({
  imports: [InfrastructureModule, PaymentsModule],
  providers: [
    RegisterAgencyUseCase,
    RegisterHostUseCase,
    LoginUseCase,
    ApproveAgencyUseCase,
    ListPendingAgenciesUseCase,
    CreateTripUseCase,
    ListTripsUseCase,
    ListPublicTripsUseCase,
    GetPublicTripByIdUseCase,
    GetTripByIdUseCase,
    GetTripStatsUseCase,
    UpdateTripUseCase,
    DeleteTripUseCase,
    ChangeTripStatusUseCase,
    ToggleTripActiveUseCase,
    CreateExpeditionUseCase,
    ListExpeditionsUseCase,
    ListAgencyExpeditionsUseCase,
    UpdateExpeditionUseCase,
    DeleteExpeditionUseCase,
    UpdateUserProfileUseCase,
    ChangePasswordUseCase,
    UpdateAgencyUseCase,
    CreateAgencyMemberUseCase,
    UpdateAgencyMemberUseCase,
    DeleteAgencyMemberUseCase,
    ToggleAgencyMemberActiveUseCase,
    ActivateAgencyMemberUseCase,
    DeactivateAgencyMemberUseCase,
    ChangeAgencyMemberPasswordUseCase,
    ListAgencyMembersUseCase,
    GetAgencyInsightsUseCase,
    CreateBookingUseCase,
    CreateBookingFromTripUseCase,
    ListMyBookingsUseCase,
    ListAgencyBookingsUseCase,
    UpdateBookingPaymentUseCase,
    CancelPendingBookingUseCase,
    BookingCleanupService,
    ExpeditionStatusUpdateService,
    QRCodeService,
    ValidateDiscountForTripUseCase,
    RegisterPromoterViewUseCase,
    ToggleTripFavoriteUseCase,
    ListMyFavoritesUseCase,
    CreateTripReviewUseCase,
    UpdateTripReviewUseCase,
    DeleteTripReviewUseCase,
    ListTripReviewsUseCase,
    CreateSuperAdminUseCase,
    CreateFirstSuperAdminUseCase,
    ListAllAgenciesUseCase,
    ListPendingHostsUseCase,
    ApproveHostUseCase,
    GetAdminMetricsUseCase,
  ],
  exports: [
    RegisterAgencyUseCase,
    RegisterHostUseCase,
    LoginUseCase,
    ApproveAgencyUseCase,
    ListPendingAgenciesUseCase,
    CreateTripUseCase,
    ListTripsUseCase,
    ListPublicTripsUseCase,
    GetPublicTripByIdUseCase,
    GetTripByIdUseCase,
    GetTripStatsUseCase,
    UpdateTripUseCase,
    DeleteTripUseCase,
    ChangeTripStatusUseCase,
    ToggleTripActiveUseCase,
    CreateExpeditionUseCase,
    ListExpeditionsUseCase,
    ListAgencyExpeditionsUseCase,
    UpdateExpeditionUseCase,
    DeleteExpeditionUseCase,
    UpdateUserProfileUseCase,
    ChangePasswordUseCase,
    UpdateAgencyUseCase,
    CreateAgencyMemberUseCase,
    UpdateAgencyMemberUseCase,
    DeleteAgencyMemberUseCase,
    ToggleAgencyMemberActiveUseCase,
    ActivateAgencyMemberUseCase,
    DeactivateAgencyMemberUseCase,
    ChangeAgencyMemberPasswordUseCase,
    ListAgencyMembersUseCase,
    GetAgencyInsightsUseCase,
    CreateBookingUseCase,
    CreateBookingFromTripUseCase,
    ListMyBookingsUseCase,
    ListAgencyBookingsUseCase,
    UpdateBookingPaymentUseCase,
    CancelPendingBookingUseCase,
    BookingCleanupService,
    ExpeditionStatusUpdateService,
    QRCodeService,
    ValidateDiscountForTripUseCase,
    RegisterPromoterViewUseCase,
    ToggleTripFavoriteUseCase,
    ListMyFavoritesUseCase,
    CreateTripReviewUseCase,
    UpdateTripReviewUseCase,
    DeleteTripReviewUseCase,
    ListTripReviewsUseCase,
    CreateSuperAdminUseCase,
    CreateFirstSuperAdminUseCase,
    ListAllAgenciesUseCase,
    ListPendingHostsUseCase,
    ApproveHostUseCase,
    GetAdminMetricsUseCase,
  ],
})
export class ApplicationModule {}
