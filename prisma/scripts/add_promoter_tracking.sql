-- Script para agregar campos de promoter tracking
-- Ejecutar este script directamente en tu base de datos CockroachDB

-- 1. Agregar viewCount a promoters (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'promoters' AND column_name = 'view_count'
    ) THEN
        ALTER TABLE "promoters" ADD COLUMN "view_count" INT4 NOT NULL DEFAULT 0;
    END IF;
END $$;

-- 2. Agregar promoterCode a bookings (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'promoter_code'
    ) THEN
        ALTER TABLE "bookings" ADD COLUMN "promoter_code" STRING;
    END IF;
END $$;

-- 3. Crear tabla promoter_views (si no existe)
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

-- 4. Crear índices únicos (si no existen)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'promoter_views_promoter_id_id_trip_user_id_key'
    ) THEN
        CREATE UNIQUE INDEX "promoter_views_promoter_id_id_trip_user_id_key" 
        ON "promoter_views"("promoter_id", "id_trip", "user_id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'promoter_views_promoter_id_idx'
    ) THEN
        CREATE INDEX "promoter_views_promoter_id_idx" ON "promoter_views"("promoter_id");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'promoter_views_id_trip_idx'
    ) THEN
        CREATE INDEX "promoter_views_id_trip_idx" ON "promoter_views"("id_trip");
    END IF;
END $$;

-- 5. Agregar foreign keys (si no existen)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'promoter_views_promoter_id_fkey'
    ) THEN
        ALTER TABLE "promoter_views" 
        ADD CONSTRAINT "promoter_views_promoter_id_fkey" 
        FOREIGN KEY ("promoter_id") REFERENCES "promoters"("id_promoter") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'promoter_views_id_trip_fkey'
    ) THEN
        ALTER TABLE "promoter_views" 
        ADD CONSTRAINT "promoter_views_id_trip_fkey" 
        FOREIGN KEY ("id_trip") REFERENCES "trips"("id_trip") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'promoter_views_user_id_fkey'
    ) THEN
        ALTER TABLE "promoter_views" 
        ADD CONSTRAINT "promoter_views_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "user"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Mensaje de confirmación
SELECT 'Campos de promoter tracking agregados exitosamente' AS message;
