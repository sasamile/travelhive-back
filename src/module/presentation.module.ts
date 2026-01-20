import { Module } from '@nestjs/common';
import { AuthController } from '../presentation/controllers/auth.controller';
import { AdminController } from '../presentation/controllers/admin.controller';
import { AgencyController } from '../presentation/controllers/agency.controller';
import { ApplicationModule } from '../application/application.module';
import { StorageModule } from '../config/storage/storage.module';
import { DatabaseModule } from '../infrastructure/database/database.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';

@Module({
  imports: [ApplicationModule, StorageModule, DatabaseModule, InfrastructureModule],
  controllers: [AuthController, AdminController, AgencyController],
})
export class PresentationModule {}
