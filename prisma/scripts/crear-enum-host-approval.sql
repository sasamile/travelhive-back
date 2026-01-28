-- Script para crear enum HostApprovalStatus (OPCIONAL)
-- La aplicación ya funciona con VARCHAR, este script es solo si quieres usar enum
-- Ejecuta paso por paso en CockroachDB

-- Paso 1: Eliminar índices
DROP INDEX IF EXISTS "user_host_approval_status_idx" CASCADE;
DROP INDEX IF EXISTS "user_host_pending_idx" CASCADE;

-- Paso 2: Crear enum
CREATE TYPE IF NOT EXISTS "HostApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Paso 3: Cambiar tipo (EJECUTA SOLO ESTE COMANDO, sin los otros)
ALTER TABLE "user" 
ALTER COLUMN "host_approval_status" TYPE "HostApprovalStatus" 
USING "host_approval_status"::text::"HostApprovalStatus";

-- Paso 4: Recrear índices
CREATE INDEX IF NOT EXISTS "user_host_approval_status_idx" 
ON "user"("host_approval_status") WHERE "is_host" = true;

CREATE INDEX IF NOT EXISTS "user_host_pending_idx" 
ON "user"("is_host", "host_approval_status") 
WHERE "is_host" = true AND "host_approval_status" = 'PENDING';
