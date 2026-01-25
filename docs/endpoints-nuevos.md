# Endpoints nuevos (Perfil + Agencia + Compras)

> Base URL local típica: `http://localhost:3000`
> 
> **Auth**: Better Auth usa **cookies**. En Postman, primero logueas y luego usas los endpoints protegidos con la cookie.

---

## 0) Autenticación (para obtener cookie)

### 0.1 Iniciar sesión
**POST** `/api/auth/sign-in/email`

```bash
curl --location --request POST "http://localhost:3000/api/auth/sign-in/email" \
  --header "Content-Type: application/json" \
  --data-raw "{\"email\":\"user@example.com\",\"password\":\"password123\"}" \
  --cookie-jar cookies.txt
```

### 0.2 Obtener sesión (opcional)
**GET** `/api/auth/get-session`

```bash
curl --location --request GET "http://localhost:3000/api/auth/get-session" \
  --cookie cookies.txt
```

### 0.3 Cerrar sesión (Logout)
**POST** `/api/auth/sign-out`

```bash
curl --location --request POST "http://localhost:3000/api/auth/sign-out" \
  --cookie cookies.txt
```

### 0.4 Iniciar sesión / Registrarse con Google (Para viajeros)

**⚠️ Configuración previa requerida:**
1. Crear credenciales OAuth en [Google Cloud Console](https://console.cloud.google.com/apis/dashboard)
2. Agregar Redirect URI: `http://localhost:3000/api/auth/callback/google`
3. Configurar variables de entorno:
   ```bash
   GOOGLE_CLIENT_ID=tu-client-id-de-google
   GOOGLE_CLIENT_SECRET=tu-client-secret-de-google
   ```

#### 0.4.1 Iniciar sesión / Registrarse con Google
**POST** `/api/auth/sign-in/social`

✅ **Este mismo endpoint funciona tanto para REGISTRO como para LOGIN de viajeros.**

- **Si el usuario NO existe:** Se crea automáticamente después de autenticarse con Google (registro)
- **Si el usuario YA existe:** Se inicia sesión automáticamente (login)

Este endpoint devuelve la URL de Google para iniciar el flujo OAuth.

```bash
curl --location --request POST "http://localhost:3000/api/auth/sign-in/social" \
  --header "Content-Type: application/json" \
  --data-raw "{\"provider\":\"google\",\"callbackURL\":\"http://localhost:3001/customers\"}" \
  --cookie-jar cookies.txt
```

**Parámetros:**
- `provider` (string, requerido): Debe ser `"google"`
- `callbackURL` (string, opcional): URL completa a la que redirigir después del login exitoso
  - Puede ser una URL completa: `http://localhost:3001/customers`
  - O una ruta relativa: `/dashboard` (se redirige a `http://localhost:3000/dashboard`)
  - Si no se especifica, default: `/` (redirige a `http://localhost:3000/`)

**Respuesta:**
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."
}
```

**Flujo completo (Registro y Login):**
1. Ejecuta el curl para obtener la URL de autorización (especifica `callbackURL` con la URL de tu frontend)
2. Copia la URL del campo `url` en la respuesta
3. Abre esa URL en tu navegador
4. Autentícate con Google
5. Google redirigirá automáticamente a `/api/auth/callback/google` (backend)
6. Better Auth procesará el callback:
   - **Si es usuario nuevo:** Lo crea automáticamente (registro)
   - **Si ya existe:** Inicia sesión (login)
7. Redirige al `callbackURL` especificado (tu frontend: `http://localhost:3001/customers`)
8. Las cookies de sesión se guardan automáticamente en `cookies.txt`

**Ejemplo para redirigir al frontend:**
```bash
# Redirige a http://localhost:3001/customers después del login
curl --location --request POST "http://localhost:3000/api/auth/sign-in/social" \
  --header "Content-Type: application/json" \
  --data-raw "{\"provider\":\"google\",\"callbackURL\":\"http://localhost:3001/customers\"}" \
  --cookie-jar cookies.txt
```

#### 0.4.2 Verificar sesión después de login con Google
**GET** `/api/auth/get-session`

Después de completar el flujo OAuth en el navegador, puedes verificar la sesión:

```bash
curl --location --request GET "http://localhost:3000/api/auth/get-session" \
  --cookie cookies.txt
```

**Respuesta esperada (usuario autenticado):**
```json
{
  "user": {
    "id": "clx...",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "emailVerified": true,
    "image": "https://lh3.googleusercontent.com/..."
  },
  "session": {
    "id": "...",
    "expiresAt": "2026-01-26T..."
  }
}
```

#### 0.4.3 Obtener perfil completo (incluye agencias si tiene)
**GET** `/auth/me`

Obtiene el perfil completo del usuario autenticado, incluyendo sus agencias (si tiene alguna):

```bash
curl --location --request GET "http://localhost:3000/auth/me" \
  --cookie cookies.txt
```

**Respuesta para viajero (sin agencias):**
```json
{
  "user": {
    "id": "clx...",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "emailVerified": true,
    "image": "https://lh3.googleusercontent.com/...",
    "dniUser": null,
    "phoneUser": null
  },
  "agencies": []
}
```

**Nota:** El callback de Google (`/api/auth/callback/google`) es manejado automáticamente por Better Auth y no requiere curl manual.

#### 0.4.4 Troubleshooting - Errores comunes

**Error: `invalid_client` o `Unauthorized`**
- ✅ Verifica que `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` estén en tu archivo `.env`
- ✅ Verifica que las credenciales sean correctas (copia exacta desde Google Cloud Console)
- ✅ Reinicia el servidor después de cambiar las variables de entorno
- ✅ Verifica que el Redirect URI en Google Cloud Console sea exactamente: `http://localhost:3000/api/auth/callback/google`

**Error: `invalid_code`**
- ✅ El código de autorización puede haber expirado (válido por ~10 minutos)
- ✅ Intenta iniciar el flujo OAuth nuevamente desde el paso 1
- ✅ Verifica que el Redirect URI coincida exactamente con el configurado en Google Cloud Console

**Verificar configuración en Google Cloud Console:**
1. Ve a [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Selecciona tu proyecto
3. Abre las credenciales OAuth 2.0
4. Verifica que el **Redirect URI** incluya exactamente:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
5. Verifica que el **Client ID** y **Client Secret** coincidan con los de tu `.env`

**Verificar que las variables de entorno se carguen:**
```bash
# En la terminal, verifica que las variables estén cargadas:
echo $GOOGLE_CLIENT_ID
echo $GOOGLE_CLIENT_SECRET
```

---

## 1) Perfil de usuario

### 1.1 Obtener perfil
**GET** `/auth/me`

```bash
curl --location --request GET "http://localhost:3000/auth/me" \
  --cookie cookies.txt
```

### 1.2 Actualizar perfil (form-data)
**PATCH** `/auth/me`

✅ Acepta `multipart/form-data`.

Campos:
- `data` (string JSON) **opcional** (recomendado)
- `picture` (file) **opcional** (se sube a S3 y se guarda la URL)

**Ejemplo (data + archivo):**
```bash
curl --location --request PATCH "http://localhost:3000/auth/me" \
  --cookie cookies.txt \
  --form "data={\"nameUser\":\"Nuevo Nombre\",\"phoneUser\":\"+57 300 000 0000\"}" \
  --form "picture=@C:/ruta/mi-foto.png"
```

**Ejemplo (campos sueltos sin archivo):**
```bash
curl --location --request PATCH "http://localhost:3000/auth/me" \
  --cookie cookies.txt \
  --form "nameUser=Nuevo Nombre" \
  --form "phoneUser=+57 300 000 0000"
```

---

## 2) Agencia

### 2.1 Obtener información de mi agencia
**GET** `/auth/me`

Este endpoint devuelve el perfil del usuario autenticado junto con todas sus agencias asociadas.

```bash
curl --location --request GET "http://localhost:3000/auth/me" \
  --cookie cookies.txt
```

**Respuesta incluye:**
- Información del usuario
- Array de agencias con sus datos completos (nombre, email, teléfono, NIT, RNT, estado de aprobación, etc.)

### 2.2 Actualizar mi agencia (form-data)
**PATCH** `/agencies/me`

✅ Acepta `multipart/form-data`.

Campos:
- `data` (string JSON) **opcional** (recomendado)
- `picture` (file) **opcional** (logo, se sube a S3)

**Permisos:** rol `admin` o `editor` dentro de la agencia.

**Ejemplo (data + archivo):**
```bash
curl --location --request PATCH "http://localhost:3000/agencies/me" \
  --cookie cookies.txt \
  --form "data={\"phone\":\"+57 301 123 4567\",\"nameAgency\":\"Mi Agencia\"}" \
  --form "picture=@C:/ruta/logo.png"
```

**Ejemplo (campos sueltos sin archivo):**
```bash
curl --location --request PATCH "http://localhost:3000/agencies/me" \
  --cookie cookies.txt \
  --form "phone=+57 301 123 4567" \
  --form "nameAgency=Mi Agencia"
```

---

## 3) Compras (Bookings)

### 3.1 Crear compra (Booking)
**POST** `/agencies/bookings`

```bash
curl --location --request POST "http://localhost:3000/agencies/bookings" \
  --header "Content-Type: application/json" \
  --cookie cookies.txt \
  --data-raw "{\"idTrip\":\"1\",\"idExpedition\":\"1\",\"adults\":2,\"children\":0}"
```

### 3.2 Listar mis compras
**GET** `/agencies/bookings`

```bash
curl --location --request GET "http://localhost:3000/agencies/bookings" \
  --cookie cookies.txt
```
