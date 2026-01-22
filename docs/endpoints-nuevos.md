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

### 2.1 Actualizar mi agencia (form-data)
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
