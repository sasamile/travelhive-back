-- Script SQL para agregar campo is_host a la tabla user
-- Ejecutar directamente en la base de datos antes de regenerar Prisma Client

-- Agregar columna is_host si no existe
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS is_host BOOL NOT NULL DEFAULT false;

-- Verificar que la columna se agregó correctamente
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user' 
  AND column_name = 'is_host';
