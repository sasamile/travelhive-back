# Crear el Primer Super Administrador

## Paso 1: Ejecutar la Migración SQL

**IMPORTANTE:** Antes de crear el primer super administrador, debes ejecutar la migración SQL para agregar las columnas necesarias.

### Opción A: Usando el script SQL directamente

```bash
# Conectarte a tu base de datos CockroachDB
psql "postgresql://usuario:password@host:port/database?sslmode=require"

# Ejecutar el script
\i prisma/scripts/add-host-approval-and-super-admin.sql
```

### Opción B: Copiar y pegar el SQL

Copia el contenido de `prisma/migrations/20260128003350_add_host_approval_and_super_admin/migration.sql` y ejecútalo en tu cliente SQL.

### Opción C: Usando Prisma Migrate

```bash
npx prisma migrate deploy
```

## Paso 2: Regenerar Prisma Client

```bash
npx prisma generate
```

## Paso 3: Crear el Primer Super Administrador

### Endpoint Público (Sin Autenticación)

**POST** `http://localhost:3000/admin/first-super-admin`

### Ejemplo con cURL

```bash
curl --location --request POST 'http://localhost:3000/admin/first-super-admin' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "admin@example.com",
  "name": "Super Administrador",
  "password": "tu_password_seguro_aqui"
}'
```

### Ejemplo con Postman

1. **Método:** POST
2. **URL:** `http://localhost:3000/admin/first-super-admin`
3. **Headers:**
   - `Content-Type: application/json`
4. **Body (raw JSON):**
   ```json
   {
     "email": "admin@example.com",
     "name": "Super Administrador",
     "password": "tu_password_seguro_aqui"
   }
   ```

### Respuesta Exitosa

```json
{
  "id": "cmkxhfqwx00005b489v3s705j",
  "email": "admin@example.com",
  "name": "Super Administrador",
  "isSuperAdmin": true,
  "message": "Primer super administrador creado exitosamente",
  "createdAt": "2026-01-28T05:40:00.000Z"
}
```

### Errores Posibles

#### 1. Columna no existe (No ejecutaste la migración)
```json
{
  "code": "P2022",
  "message": "The column `public.user.is_super_admin` does not exist"
}
```
**Solución:** Ejecuta la migración SQL primero.

#### 2. Ya existe un super administrador
```json
{
  "statusCode": 400,
  "message": "Ya existe un super administrador en el sistema. Usa el endpoint POST /admin/super-admin con autenticación para crear más."
}
```
**Solución:** Usa el endpoint `/admin/super-admin` con autenticación.

#### 3. Email ya está en uso
```json
{
  "statusCode": 409,
  "message": "Este email ya está registrado"
}
```
**Solución:** El usuario existente será actualizado a super administrador automáticamente.

## Paso 4: Verificar que Funcionó

Después de crear el super administrador, puedes iniciar sesión con ese usuario y usar los demás endpoints de administración.

### Iniciar Sesión

```bash
curl --location --request POST 'http://localhost:3000/api/auth/sign-in/email' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "admin@example.com",
  "password": "tu_password_seguro_aqui"
}'
```

## Notas Importantes

1. **Seguridad:** Este endpoint solo funciona si NO existe ningún super administrador. Una vez creado el primero, este endpoint se desactiva automáticamente.

2. **Contraseña:** La contraseña se hashea automáticamente con bcrypt antes de guardarse.

3. **Email Verificado:** El super administrador se crea con `emailVerified: true` automáticamente.

4. **Si el usuario ya existe:** Si el email ya está registrado, el usuario existente será actualizado a super administrador en lugar de crear uno nuevo.
