-- Script SQL para agregar la tabla de promoters y el campo id_promoter a trips
-- Ejecutar este script directamente en tu base de datos CockroachDB
-- Puedes ejecutarlo usando: psql o desde el cliente de CockroachDB

-- 1. Crear tabla de promoters
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

-- 2. Crear índice único para el código del promoter
CREATE UNIQUE INDEX IF NOT EXISTS "promoters_code_key" ON "promoters"("code");

-- 3. Agregar foreign key a agencies
ALTER TABLE "promoters" 
ADD CONSTRAINT IF NOT EXISTS "promoters_id_agency_fkey" 
FOREIGN KEY ("id_agency") 
REFERENCES "agencies"("id_agency") 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- 4. Agregar columna id_promoter a trips
ALTER TABLE "trips" 
ADD COLUMN IF NOT EXISTS "id_promoter" INT8;

-- 5. Agregar foreign key de trips a promoters
ALTER TABLE "trips" 
ADD CONSTRAINT IF NOT EXISTS "trips_id_promoter_fkey" 
FOREIGN KEY ("id_promoter") 
REFERENCES "promoters"("id_promoter") 
ON DELETE SET NULL 
ON UPDATE CASCADE;
