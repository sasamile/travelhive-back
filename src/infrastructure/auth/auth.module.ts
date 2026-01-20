import { Module, Global } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma/prisma.service';
import { createAuthInstance } from './auth.config';

@Global()
@Module({
  imports: [
    DatabaseModule,
    BetterAuthModule.forRootAsync({
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => {
        // PrismaService extiende PrismaClient, así que funciona directamente
        const auth = createAuthInstance(prisma as any);
        return { auth };
      },
    }),
  ],
  exports: [BetterAuthModule],
})
export class AuthModule {}
