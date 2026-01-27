// Script para aplicar cambios de favoritos y reseñas
// Ejecutar con: npm run prisma:apply:favorites-reviews

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

async function applyFavoritesAndReviews() {
  console.log('🚀 Aplicando cambios de favoritos y reseñas...\n');

  try {
    // 1. Crear tabla trip_favorites
    console.log('1️⃣  Creando tabla trip_favorites...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "trip_favorites" (
          "id" INT8 NOT NULL DEFAULT unique_rowid(),
          "user_id" STRING NOT NULL,
          "id_trip" INT8 NOT NULL,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "trip_favorites_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('   ✅ Tabla trip_favorites creada\n');

    // 2. Crear tabla trip_reviews
    console.log('2️⃣  Creando tabla trip_reviews...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "trip_reviews" (
          "id" INT8 NOT NULL DEFAULT unique_rowid(),
          "user_id" STRING NOT NULL,
          "id_trip" INT8 NOT NULL,
          "rating" INT4 NOT NULL,
          "comment" STRING,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "trip_reviews_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('   ✅ Tabla trip_reviews creada\n');

    // 3. Crear índices
    console.log('3️⃣  Creando índices...');
    
    // Índice único para favoritos
    const hasFavoriteUniqueIndex = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'trip_favorites_user_id_id_trip_key'
      ) as exists;
    `);
    
    if (!hasFavoriteUniqueIndex[0]?.exists) {
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX "trip_favorites_user_id_id_trip_key" 
        ON "trip_favorites"("user_id", "id_trip");
      `);
    }

    // Índice único para reviews
    const hasReviewUniqueIndex = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'trip_reviews_user_id_id_trip_key'
      ) as exists;
    `);
    
    if (!hasReviewUniqueIndex[0]?.exists) {
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX "trip_reviews_user_id_id_trip_key" 
        ON "trip_reviews"("user_id", "id_trip");
      `);
    }

    // Otros índices
    const indexes = [
      { name: 'trip_favorites_user_id_idx', table: 'trip_favorites', column: 'user_id' },
      { name: 'trip_favorites_id_trip_idx', table: 'trip_favorites', column: 'id_trip' },
      { name: 'trip_reviews_id_trip_idx', table: 'trip_reviews', column: 'id_trip' },
      { name: 'trip_reviews_user_id_idx', table: 'trip_reviews', column: 'user_id' },
      { name: 'trip_reviews_rating_idx', table: 'trip_reviews', column: 'rating' },
    ];

    for (const idx of indexes) {
      const exists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
        SELECT EXISTS (
          SELECT 1 FROM pg_indexes 
          WHERE indexname = '${idx.name}'
        ) as exists;
      `);
      
      if (!exists[0]?.exists) {
        await prisma.$executeRawUnsafe(`
          CREATE INDEX "${idx.name}" ON "${idx.table}"("${idx.column}");
        `);
      }
    }
    console.log('   ✅ Índices creados\n');

    // 4. Agregar foreign keys
    console.log('4️⃣  Agregando foreign keys...');
    
    const foreignKeys = [
      {
        name: 'trip_favorites_user_id_fkey',
        table: 'trip_favorites',
        column: 'user_id',
        refTable: 'user',
        refColumn: 'id',
      },
      {
        name: 'trip_favorites_id_trip_fkey',
        table: 'trip_favorites',
        column: 'id_trip',
        refTable: 'trips',
        refColumn: 'id_trip',
      },
      {
        name: 'trip_reviews_user_id_fkey',
        table: 'trip_reviews',
        column: 'user_id',
        refTable: 'user',
        refColumn: 'id',
      },
      {
        name: 'trip_reviews_id_trip_fkey',
        table: 'trip_reviews',
        column: 'id_trip',
        refTable: 'trips',
        refColumn: 'id_trip',
      },
    ];

    for (const fk of foreignKeys) {
      const exists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = '${fk.name}'
        ) as exists;
      `);
      
      if (!exists[0]?.exists) {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "${fk.table}" 
          ADD CONSTRAINT "${fk.name}" 
          FOREIGN KEY ("${fk.column}") REFERENCES "${fk.refTable}"("${fk.refColumn}") 
          ON DELETE CASCADE ON UPDATE CASCADE;
        `);
      }
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

applyFavoritesAndReviews();
