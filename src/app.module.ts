import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AuthModule } from './infrastructure/auth/auth.module';
import { PresentationModule } from './module/presentation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(), // Habilita tareas programadas (cron jobs)
    DatabaseModule,
    AuthModule,
    PresentationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
