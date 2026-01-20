import { Module } from '@nestjs/common';
import { AuthController } from '../presentation/controllers/auth.controller';
import { AdminController } from '../presentation/controllers/admin.controller';
import { AgencyController } from '../presentation/controllers/agency.controller';
import { ApplicationModule } from '../application/application.module';

@Module({
  imports: [ApplicationModule],
  controllers: [AuthController, AdminController, AgencyController],
})
export class PresentationModule {}
