require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL no está definida en las variables de entorno');
  process.exit(1);
}

// Crear el pool de conexiones de PostgreSQL
const pool = new Pool({ connectionString: databaseUrl });

// Crear el adapter de Prisma para PostgreSQL
const adapter = new PrismaPg(pool);

// Crear PrismaClient con el adapter
const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

async function applyMigration() {
  try {
    console.log('Aplicando migración de promoters...\n');

    // 1. Crear tabla de promoters
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "promoters" (
        "id_promoter" INT8 NOT NULL DEFAULT unique_rowid(),
        "id_agency" INT8 NOT NULL,
        "code" STRING NOT NULL,
        "name" STRING NOT NULL,
        "email" STRING,
        "phone" STRING,
        "referral_count" INT4 NOT NULL DEFAULT 0,
        "is_active" BOOL NOT NULL DEFAULT true,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "promoters_pkey" PRIMARY KEY ("id_promoter")
      );
    `);
    console.log('✅ Tabla promoters creada');

    // 2. Crear índice único
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "promoters_code_key" ON "promoters"("code");
    `);
    console.log('✅ Índice único creado');

    // 3. Agregar foreign key a agencies
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "promoters" 
        ADD CONSTRAINT "promoters_id_agency_fkey" 
        FOREIGN KEY ("id_agency") 
        REFERENCES "agencies"("id_agency") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
      `);
      console.log('✅ Foreign key a agencies agregada');
    } catch (error) {
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        console.log('⚠️  Foreign key a agencies ya existe (ignorando)');
      } else {
        throw error;
      }
    }

    // 4. Agregar columna id_promoter a trips
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "trips" 
      ADD COLUMN IF NOT EXISTS "id_promoter" INT8;
    `);
    console.log('✅ Columna id_promoter agregada a trips');

    // 5. Agregar foreign key de trips a promoters
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "trips" 
        ADD CONSTRAINT "trips_id_promoter_fkey" 
        FOREIGN KEY ("id_promoter") 
        REFERENCES "promoters"("id_promoter") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
      `);
      console.log('✅ Foreign key de trips a promoters agregada');
    } catch (error) {
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        console.log('⚠️  Foreign key de trips a promoters ya existe (ignorando)');
      } else {
        throw error;
      }
    }

    console.log('\n✅ Migración aplicada exitosamente!');
    console.log('El servidor ahora debería funcionar correctamente.');
  } catch (error) {
    console.error('\n❌ Error aplicando migración:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .then(() => {
    console.log('\n✅ Proceso completado');
    return prisma.$disconnect();
  })
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    prisma.$disconnect().finally(() => {
      pool.end();
      process.exit(1);
    });
  });
