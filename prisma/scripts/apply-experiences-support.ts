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

async function applyExperiencesSupport() {
  try {
    console.log('🔄 Aplicando soporte para experiencias de anfitriones...');

    // Verificar si la columna id_host ya existe
    const hostColumnExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'trips' 
        AND column_name = 'id_host'
      ) as exists;
    `);

    if (!hostColumnExists[0]?.exists) {
      console.log('➕ Agregando columna id_host a trips...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "trips" 
        ADD COLUMN IF NOT EXISTS id_host STRING;
      `);
      console.log('✅ Columna id_host agregada');
    } else {
      console.log('ℹ️  Columna id_host ya existe');
    }

    // Hacer id_agency opcional (nullable)
    const agencyColumnNullable = await prisma.$queryRawUnsafe<Array<{ is_nullable: string }>>(`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'trips' 
        AND column_name = 'id_agency';
    `);

    if (agencyColumnNullable[0]?.is_nullable === 'NO') {
      console.log('➕ Haciendo id_agency opcional (nullable)...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "trips" 
        ALTER COLUMN id_agency DROP NOT NULL;
      `);
      console.log('✅ Columna id_agency ahora es opcional');
    } else {
      console.log('ℹ️  Columna id_agency ya es opcional');
    }

    // Agregar columna location si no existe
    const locationExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'trips' 
        AND column_name = 'location'
      ) as exists;
    `);

    if (!locationExists[0]?.exists) {
      console.log('➕ Agregando columna location...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "trips" 
        ADD COLUMN IF NOT EXISTS location STRING;
      `);
      console.log('✅ Columna location agregada');
    } else {
      console.log('ℹ️  Columna location ya existe');
    }

    // Agregar índice para id_host
    const hostIndexExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'trips' 
        AND indexname = 'trips_id_host_idx'
      ) as exists;
    `);

    if (!hostIndexExists[0]?.exists) {
      console.log('➕ Creando índice para id_host...');
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS trips_id_host_idx ON "trips" (id_host);
      `);
      console.log('✅ Índice para id_host creado');
    } else {
      console.log('ℹ️  Índice para id_host ya existe');
    }

    // Agregar foreign key para id_host -> user.id
    const fkExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'trips' 
        AND constraint_name = 'trips_id_host_fkey'
      ) as exists;
    `);

    if (!fkExists[0]?.exists) {
      console.log('➕ Agregando foreign key id_host -> user.id...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "trips" 
        ADD CONSTRAINT trips_id_host_fkey 
        FOREIGN KEY (id_host) REFERENCES "user"(id) ON DELETE CASCADE;
      `);
      console.log('✅ Foreign key agregada');
    } else {
      console.log('ℹ️  Foreign key ya existe');
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

applyExperiencesSupport()
  .then(() => {
    console.log('✨ Proceso finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
