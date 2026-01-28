import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function applyBookingAgencyNullable() {
  try {
    console.log('🔄 Haciendo id_agency opcional en bookings...');

    // Verificar si la columna ya es nullable
    const columnInfo = await prisma.$queryRawUnsafe<Array<{ is_nullable: string }>>(`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' 
        AND column_name = 'id_agency';
    `);

    if (columnInfo[0]?.is_nullable === 'NO') {
      console.log('➕ Haciendo id_agency opcional (nullable)...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "bookings" 
        ALTER COLUMN id_agency DROP NOT NULL;
      `);
      console.log('✅ Columna id_agency ahora es opcional');
    } else {
      console.log('ℹ️  Columna id_agency ya es opcional');
    }

    console.log('🔄 Regenerando Prisma Client...');
    const { execSync } = require('child_process');
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Prisma Client regenerado');

    console.log('✅ Migración completada exitosamente');
  } catch (error) {
    console.error('❌ Error aplicando migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyBookingAgencyNullable()
  .then(() => {
    console.log('✨ Proceso finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
