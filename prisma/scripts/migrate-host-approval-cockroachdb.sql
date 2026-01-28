-- ============================================================================
-- Migración: Agregar campos de aprobación para hosts y super administrador
-- Compatible con CockroachDB
-- Fecha: 2026-01-28
-- 
-- IMPORTANTE: Ejecuta este script en PASOS SEPARADOS debido al backfill de CockroachDB
-- ============================================================================

-- ============================================================================
-- PASO 1: Agregar todas las columnas (EJECUTAR PRIMERO)
-- Espera unos segundos después de ejecutar este paso antes de continuar
-- ============================================================================

ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS "is_super_admin" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS "host_approval_status" VARCHAR(50);

ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS "host_rejection_reason" TEXT;

ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS "host_reviewed_by" VARCHAR(255);

ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS "host_reviewed_at" TIMESTAMP;

-- ============================================================================
-- PASO 2: Actualizar hosts existentes (EJECUTAR DESPUÉS DE PASO 1, esperar 5-10 segundos)
-- Si obtienes error de backfill, espera más tiempo y vuelve a intentar
-- ============================================================================

UPDATE "user" 
SET "host_approval_status" = 'PENDING' 
WHERE "is_host" = true 
  AND "host_approval_status" IS NULL;

-- ============================================================================
-- PASO 3: Crear índices (EJECUTAR DESPUÉS DE PASO 2)
-- ============================================================================

CREATE INDEX IF NOT EXISTS "user_host_approval_status_idx" 
ON "user"("host_approval_status") 
WHERE "is_host" = true;

CREATE INDEX IF NOT EXISTS "user_is_super_admin_idx" 
ON "user"("is_super_admin") 
WHERE "is_super_admin" = true;

CREATE INDEX IF NOT EXISTS "user_host_pending_idx" 
ON "user"("is_host", "host_approval_status") 
WHERE "is_host" = true AND "host_approval_status" = 'PENDING';

-- ============================================================================
-- Verificación (opcional - ejecuta esto para verificar que todo se creó bien)
-- ============================================================================
-- SELECT 
--   column_name, 
--   data_type, 
--   is_nullable, 
--   column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'user' 
--   AND column_name IN ('is_super_admin', 'host_approval_status', 'host_rejection_reason', 'host_reviewed_by', 'host_reviewed_at')
-- ORDER BY column_name;
