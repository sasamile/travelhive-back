-- Script SQL para agregar campos city y department a la tabla user
-- Ejecutar directamente en la base de datos antes de regenerar Prisma Client

-- Agregar columna city si no existe
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS city STRING;

-- Agregar columna department si no existe
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS department STRING;

-- Verificar que las columnas se agregaron correctamente
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'user' 
  AND column_name IN ('city', 'department')
ORDER BY column_name;
