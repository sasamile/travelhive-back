-- ============================================================================
-- Migración: Agregar campos de aprobación para hosts y super administrador
-- Fecha: 2026-01-28
-- Descripción: Agrega campos necesarios para el sistema de aprobación de hosts
--               y la funcionalidad de super administrador
-- ============================================================================

-- 1. Agregar campos al modelo User
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "host_approval_status" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "host_rejection_reason" TEXT,
ADD COLUMN IF NOT EXISTS "host_reviewed_by" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "host_reviewed_at" TIMESTAMP;

-- 2. Agregar comentarios para documentación
COMMENT ON COLUMN "user"."is_super_admin" IS 'Indica si el usuario es super administrador de la plataforma';
COMMENT ON COLUMN "user"."host_approval_status" IS 'Estado de aprobación para hosts: PENDING (pendiente), APPROVED (aprobado), REJECTED (rechazado)';
COMMENT ON COLUMN "user"."host_rejection_reason" IS 'Razón de rechazo proporcionada por el super administrador si el host fue rechazado';
COMMENT ON COLUMN "user"."host_reviewed_by" IS 'ID del super administrador que revisó y aprobó/rechazó el host';
COMMENT ON COLUMN "user"."host_reviewed_at" IS 'Fecha y hora en que el super administrador revisó el host';

-- 3. Establecer estado PENDING para todos los hosts existentes que no tengan estado
--    Esto asegura que los hosts que ya existían antes de esta migración queden pendientes de aprobación
UPDATE "user" 
SET "host_approval_status" = 'PENDING' 
WHERE "is_host" = true 
  AND ("host_approval_status" IS NULL OR "host_approval_status" = '');

-- 4. Crear índices para mejorar el rendimiento de las consultas
--    Índice para consultas de hosts por estado de aprobación
CREATE INDEX IF NOT EXISTS "user_host_approval_status_idx" 
ON "user"("host_approval_status") 
WHERE "is_host" = true;

--    Índice para consultas de super administradores
CREATE INDEX IF NOT EXISTS "user_is_super_admin_idx" 
ON "user"("is_super_admin") 
WHERE "is_super_admin" = true;

--    Índice compuesto para consultas de hosts pendientes (más común)
CREATE INDEX IF NOT EXISTS "user_host_pending_idx" 
ON "user"("is_host", "host_approval_status") 
WHERE "is_host" = true AND "host_approval_status" = 'PENDING';

-- 5. Verificar que los campos se agregaron correctamente
--    (Opcional: puedes ejecutar esto para verificar)
-- SELECT 
--   column_name, 
--   data_type, 
--   is_nullable, 
--   column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'user' 
--   AND column_name IN ('is_super_admin', 'host_approval_status', 'host_rejection_reason', 'host_reviewed_by', 'host_reviewed_at')
-- ORDER BY column_name;

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. Después de ejecutar esta migración, ejecuta: npx prisma generate
-- 2. Para crear el primer super administrador, ejecuta:
--    UPDATE "user" SET "is_super_admin" = true WHERE email = 'tu_email@example.com';
-- 3. Los hosts existentes quedarán con estado PENDING y necesitarán aprobación
-- 4. Los nuevos hosts se crearán automáticamente con estado PENDING
-- ============================================================================
