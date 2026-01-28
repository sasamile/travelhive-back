-- AlterTable: Agregar campos de aprobación para hosts y super administrador
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "host_approval_status" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "host_rejection_reason" TEXT,
ADD COLUMN IF NOT EXISTS "host_reviewed_by" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "host_reviewed_at" TIMESTAMP;

-- Comentarios para documentación
COMMENT ON COLUMN "user"."is_super_admin" IS 'Indica si el usuario es super administrador';
COMMENT ON COLUMN "user"."host_approval_status" IS 'Estado de aprobación para hosts: PENDING, APPROVED, REJECTED';
COMMENT ON COLUMN "user"."host_rejection_reason" IS 'Razón de rechazo si el host fue rechazado';
COMMENT ON COLUMN "user"."host_reviewed_by" IS 'ID del superadmin que revisó el host';
COMMENT ON COLUMN "user"."host_reviewed_at" IS 'Fecha de revisión del host';

-- Establecer estado PENDING para todos los hosts existentes que no tengan estado
UPDATE "user" 
SET "host_approval_status" = 'PENDING' 
WHERE "is_host" = true AND "host_approval_status" IS NULL;

-- Crear índice para mejorar las consultas de hosts pendientes
CREATE INDEX IF NOT EXISTS "user_host_approval_status_idx" ON "user"("host_approval_status") WHERE "is_host" = true;

-- Crear índice para mejorar las consultas de super administradores
CREATE INDEX IF NOT EXISTS "user_is_super_admin_idx" ON "user"("is_super_admin") WHERE "is_super_admin" = true;
