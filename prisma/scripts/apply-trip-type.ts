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

async function applyTripType() {
  try {
    console.log('🔄 Aplicando campo type a trips...');

    // Crear el enum TripType si no existe
    const enumExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 
        FROM pg_type 
        WHERE typname = 'TripType'
      ) as exists;
    `);

    if (!enumExists[0]?.exists) {
      console.log('➕ Creando enum TripType...');
      await prisma.$executeRawUnsafe(`
        CREATE TYPE "TripType" AS ENUM ('TRIP', 'EXPERIENCE');
      `);
      console.log('✅ Enum TripType creado');
    } else {
      console.log('ℹ️  Enum TripType ya existe');
    }

    // Verificar si la columna type ya existe
    const columnExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'trips' 
        AND column_name = 'type'
      ) as exists;
    `);

    if (!columnExists[0]?.exists) {
      console.log('➕ Agregando columna type a trips...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "trips" 
        ADD COLUMN IF NOT EXISTS type "TripType" NOT NULL DEFAULT 'TRIP';
      `);
      console.log('✅ Columna type agregada');
    } else {
      console.log('ℹ️  Columna type ya existe');
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

applyTripType()
  .then(() => {
    console.log('✨ Proceso finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
