-- ============================================================================
-- Script: Crear el primer super administrador
-- Descripción: Establece un usuario existente como super administrador
-- ============================================================================

-- IMPORTANTE: Reemplaza 'tu_email@example.com' con el email del usuario que quieres convertir en super admin
UPDATE "user" 
SET "is_super_admin" = true 
WHERE email = 'tu_email@example.com';

-- Verificar que se actualizó correctamente
SELECT 
  id,
  email,
  name,
  "is_super_admin",
  "is_host"
FROM "user"
WHERE email = 'tu_email@example.com';

-- ============================================================================
-- NOTAS:
-- ============================================================================
-- 1. Este script convierte un usuario existente en super administrador
-- 2. El usuario debe existir en la base de datos antes de ejecutar este script
-- 3. Una vez creado el primer super admin, puedes usar el endpoint:
--    POST /admin/super-admin para crear más super administradores
-- ============================================================================
