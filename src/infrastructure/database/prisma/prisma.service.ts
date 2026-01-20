import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(configService: ConfigService) {
    const databaseUrl = configService.get<string>('DATABASE_URL');
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }

    // Asegurar que DATABASE_URL esté disponible en process.env para Prisma
    process.env.DATABASE_URL = databaseUrl;

    // Crear el pool de conexiones de PostgreSQL
    const pool = new Pool({ connectionString: databaseUrl });

    // Crear el adapter de Prisma para PostgreSQL
    const adapter = new PrismaPg(pool);

    // En Prisma 7.x, necesitamos pasar el adapter al constructor
    super({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    // Asignar el pool después de super()
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    
    // Verificar e inicializar tablas si no existen (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      try {
        const result = await this.$queryRaw<Array<{ exists: boolean }>>`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'user'
          ) as exists;
        `;
        
        if (!result[0]?.exists) {
          console.warn('⚠️  Las tablas no existen. Por favor ejecuta: npm run prisma:init');
        }
      } catch (error) {
        // Ignorar errores de verificación
        console.warn('⚠️  No se pudo verificar el estado de la base de datos');
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
