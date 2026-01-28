-- Agregar columna temporary_password a la tabla agency_members
-- Esta columna almacena la contraseña temporal para que el admin pueda verla

ALTER TABLE agency_members 
ADD COLUMN IF NOT EXISTS temporary_password TEXT;

-- Comentario en la columna
COMMENT ON COLUMN agency_members.temporary_password IS 'Contraseña temporal del miembro para que el admin pueda verla';
