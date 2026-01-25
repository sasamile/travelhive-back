-- Migración manual para agregar el campo is_active a agency_members
-- Ejecutar este script cuando tengas conexión a la base de datos

-- Verificar si la columna ya existe antes de agregarla
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'agency_members' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE "agency_members" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
        RAISE NOTICE 'Columna is_active agregada exitosamente';
    ELSE
        RAISE NOTICE 'La columna is_active ya existe';
    END IF;
END $$;
