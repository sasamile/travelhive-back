// Script para aplicar cambios de promoter tracking directamente
// Ejecutar con: npx tsx prisma/scripts/apply-promoter-tracking.ts
// O: ts-node prisma/scripts/apply-promoter-tracking.ts

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

async function applyPromoterTracking() {
  console.log('🚀 Aplicando cambios de promoter tracking...\n');

  try {
    // 1. Agregar viewCount a promoters
    console.log('1️⃣  Agregando view_count a promoters...');
    const hasViewCount = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'promoters' AND column_name = 'view_count'
      ) as exists;
    `);
    
    if (!hasViewCount[0]?.exists) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "promoters" ADD COLUMN "view_count" INT4 NOT NULL DEFAULT 0;`);
      console.log('   ✅ view_count agregado\n');
    } else {
      console.log('   ⏭️  view_count ya existe\n');
    }

    // 2. Agregar promoterCode a bookings
    console.log('2️⃣  Agregando promoter_code a bookings...');
    const hasPromoterCode = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'promoter_code'
      ) as exists;
    `);
    
    if (!hasPromoterCode[0]?.exists) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "bookings" ADD COLUMN "promoter_code" STRING;`);
      console.log('   ✅ promoter_code agregado\n');
    } else {
      console.log('   ⏭️  promoter_code ya existe\n');
    }

    // 3. Crear tabla promoter_views
    console.log('3️⃣  Creando tabla promoter_views...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "promoter_views" (
          "id" INT8 NOT NULL DEFAULT unique_rowid(),
          "promoter_id" INT8 NOT NULL,
          "id_trip" INT8 NOT NULL,
          "user_id" STRING,
          "ip_address" STRING,
          "user_agent" STRING,
          "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "promoter_views_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('   ✅ Tabla promoter_views creada\n');

    // 4. Crear índices
    console.log('4️⃣  Creando índices...');
    
    // Índice único
    const hasUniqueIndex = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'promoter_views_promoter_id_id_trip_user_id_key'
      ) as exists;
    `);
    
    if (!hasUniqueIndex[0]?.exists) {
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX "promoter_views_promoter_id_id_trip_user_id_key" 
        ON "promoter_views"("promoter_id", "id_trip", "user_id");
      `);
    }

    // Índice en promoter_id
    const hasPromoterIndex = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'promoter_views_promoter_id_idx'
      ) as exists;
    `);
    
    if (!hasPromoterIndex[0]?.exists) {
      await prisma.$executeRawUnsafe(`CREATE INDEX "promoter_views_promoter_id_idx" ON "promoter_views"("promoter_id");`);
    }

    // Índice en id_trip
    const hasTripIndex = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'promoter_views_id_trip_idx'
      ) as exists;
    `);
    
    if (!hasTripIndex[0]?.exists) {
      await prisma.$executeRawUnsafe(`CREATE INDEX "promoter_views_id_trip_idx" ON "promoter_views"("id_trip");`);
    }
    console.log('   ✅ Índices creados\n');

    // 5. Agregar foreign keys
    console.log('5️⃣  Agregando foreign keys...');
    
    const hasPromoterFk = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'promoter_views_promoter_id_fkey'
      ) as exists;
    `);
    
    if (!hasPromoterFk[0]?.exists) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "promoter_views" 
        ADD CONSTRAINT "promoter_views_promoter_id_fkey" 
        FOREIGN KEY ("promoter_id") REFERENCES "promoters"("id_promoter") 
        ON DELETE CASCADE ON UPDATE CASCADE;
      `);
    }

    const hasTripFk = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'promoter_views_id_trip_fkey'
      ) as exists;
    `);
    
    if (!hasTripFk[0]?.exists) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "promoter_views" 
        ADD CONSTRAINT "promoter_views_id_trip_fkey" 
        FOREIGN KEY ("id_trip") REFERENCES "trips"("id_trip") 
        ON DELETE CASCADE ON UPDATE CASCADE;
      `);
    }

    const hasUserFk = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'promoter_views_user_id_fkey'
      ) as exists;
    `);
    
    if (!hasUserFk[0]?.exists) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "promoter_views" 
        ADD CONSTRAINT "promoter_views_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "user"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
      `);
    }
    console.log('   ✅ Foreign keys agregadas\n');

    console.log('✅ ¡Todos los cambios aplicados exitosamente!\n');
    console.log('🔄 Regenerando Prisma Client...');
    
    // Regenerar Prisma Client
    const { execSync } = require('child_process');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    console.log('\n✅ ¡Listo! Puedes reiniciar el servidor ahora.');

  } catch (error: any) {
    console.error('❌ Error al aplicar los cambios:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

applyPromoterTracking();
