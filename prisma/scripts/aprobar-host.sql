-- Script para aprobar un host pendiente
-- Reemplaza 'EMAIL_DEL_HOST' con el email del host que quieres aprobar

UPDATE "user" 
SET 
  "host_approval_status" = 'APPROVED',
  "host_reviewed_at" = NOW()
WHERE 
  "email" = 'EMAIL_DEL_HOST' 
  AND "is_host" = true;

-- Para aprobar TODOS los hosts pendientes (usa con cuidado):
-- UPDATE "user" 
-- SET 
--   "host_approval_status" = 'APPROVED',
--   "host_reviewed_at" = NOW()
-- WHERE 
--   "is_host" = true 
--   AND ("host_approval_status" IS NULL OR "host_approval_status" = 'PENDING');
