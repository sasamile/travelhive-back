# Migración: Sistema de Aprobación de Hosts y Super Administrador

## Descripción

Esta migración agrega los campos necesarios para implementar el sistema de aprobación de hosts (anfitriones naturales) y la funcionalidad de super administrador.

## Campos Agregados

### Tabla `user`

1. **`is_super_admin`** (BOOLEAN, default: false)
   - Indica si el usuario es super administrador de la plataforma

2. **`host_approval_status`** (VARCHAR(50), nullable)
   - Estado de aprobación para hosts: `PENDING`, `APPROVED`, `REJECTED`

3. **`host_rejection_reason`** (TEXT, nullable)
   - Razón de rechazo proporcionada por el super administrador

4. **`host_reviewed_by`** (VARCHAR(255), nullable)
   - ID del super administrador que revisó el host

5. **`host_reviewed_at`** (TIMESTAMP, nullable)
   - Fecha y hora de la revisión

## Cómo Ejecutar la Migración

### Opción 1: Usando Prisma Migrate (Recomendado)

```bash
# Aplicar la migración
npx prisma migrate deploy

# O si estás en desarrollo
npx prisma migrate dev
```

### Opción 2: Ejecutar SQL Directamente

```bash
# Conectarte a tu base de datos CockroachDB
psql "postgresql://usuario:password@host:port/database?sslmode=require"

# Ejecutar el script
\i prisma/scripts/add-host-approval-and-super-admin.sql
```

O ejecuta el contenido del archivo `prisma/migrations/20260128003350_add_host_approval_and_super_admin/migration.sql` directamente.

### Opción 3: Desde el cliente SQL

Copia y pega el contenido de `prisma/scripts/add-host-approval-and-super-admin.sql` en tu cliente SQL y ejecútalo.

## Después de la Migración

1. **Regenerar Prisma Client:**
   ```bash
   npx prisma generate
   ```

2. **Crear el primer super administrador:**
   
   Opción A: Usando SQL
   ```sql
   UPDATE "user" 
   SET "is_super_admin" = true 
   WHERE email = 'tu_email@example.com';
   ```
   
   Opción B: Usando el script proporcionado
   ```bash
   # Edita el archivo primero para cambiar el email
   psql "tu_connection_string" -f prisma/scripts/create-first-super-admin.sql
   ```

## Comportamiento Post-Migración

### Hosts Existentes
- Todos los hosts existentes (`is_host = true`) que no tengan `host_approval_status` quedarán con estado `PENDING`
- Necesitarán ser aprobados por un super administrador antes de poder iniciar sesión

### Nuevos Hosts
- Cuando un usuario se registre como host, automáticamente se establecerá `host_approval_status = 'PENDING'`
- No podrán iniciar sesión hasta que un super administrador los apruebe

### Super Administradores
- Los super administradores pueden iniciar sesión independientemente de su estado de host
- Solo los super administradores pueden aprobar/rechazar hosts y agencias
- Solo los super administradores pueden crear otros super administradores

## Verificación

Para verificar que la migración se aplicó correctamente:

```sql
-- Ver estructura de la tabla
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'user' 
  AND column_name IN (
    'is_super_admin', 
    'host_approval_status', 
    'host_rejection_reason', 
    'host_reviewed_by', 
    'host_reviewed_at'
  )
ORDER BY column_name;

-- Ver hosts pendientes
SELECT id, email, name, "is_host", "host_approval_status"
FROM "user"
WHERE "is_host" = true
ORDER BY "created_at" DESC;

-- Ver super administradores
SELECT id, email, name, "is_super_admin"
FROM "user"
WHERE "is_super_admin" = true;
```

## Rollback (Si es Necesario)

Si necesitas revertir la migración:

```sql
-- Eliminar índices
DROP INDEX IF EXISTS "user_host_pending_idx";
DROP INDEX IF EXISTS "user_is_super_admin_idx";
DROP INDEX IF EXISTS "user_host_approval_status_idx";

-- Eliminar columnas
ALTER TABLE "user" 
DROP COLUMN IF EXISTS "host_reviewed_at",
DROP COLUMN IF EXISTS "host_reviewed_by",
DROP COLUMN IF EXISTS "host_rejection_reason",
DROP COLUMN IF EXISTS "host_approval_status",
DROP COLUMN IF EXISTS "is_super_admin";
```

## Archivos Relacionados

- `prisma/migrations/20260128003350_add_host_approval_and_super_admin/migration.sql` - Migración de Prisma
- `prisma/scripts/add-host-approval-and-super-admin.sql` - Script SQL standalone
- `prisma/scripts/create-first-super-admin.sql` - Script para crear el primer super admin
- `ENDPOINTS_SUPER_ADMIN.md` - Documentación de los endpoints de super admin
