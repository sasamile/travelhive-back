import { Module } from '@nestjs/common';
import { AuthController } from '../presentation/controllers/auth.controller';
import { AdminController } from '../presentation/controllers/admin.controller';
import { AgencyController } from '../presentation/controllers/agency.controller';
import { CityController } from '../presentation/controllers/city.controller';
import { TripController } from '../presentation/controllers/trip.controller';
import { BookingController } from '../presentation/controllers/booking.controller';
import { TripFavoriteController } from '../presentation/controllers/trip-favorite.controller';
import { TripReviewController } from '../presentation/controllers/trip-review.controller';
import { ExperienceController } from '../presentation/controllers/experience.controller';
import { HostController } from '../presentation/controllers/host.controller';
import { ApplicationModule } from '../application/application.module';
import { StorageModule } from '../config/storage/storage.module';
import { DatabaseModule } from '../infrastructure/database/database.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { PaymentsModule } from '../config/payments/payments.module';

@Module({
  imports: [ApplicationModule, StorageModule, DatabaseModule, InfrastructureModule, PaymentsModule],
  controllers: [
    AuthController,
    AdminController,
    AgencyController,
    CityController,
    TripController,
    BookingController,
    TripFavoriteController,
    TripReviewController,
    ExperienceController,
    HostController,
  ],
})
export class PresentationModule {}
