# Endpoints de Super Administrador

Todos los endpoints requieren autenticación y que el usuario sea super administrador (isSuperAdmin: true).

## Autenticación

Todos los endpoints están protegidos con `SuperAdminGuard` que verifica:
- Que el usuario esté autenticado
- Que el usuario tenga `isSuperAdmin: true`

## Endpoints

### 1. Crear el PRIMER Super Administrador (Público)

**POST** `/admin/first-super-admin`

Crea el primer super administrador del sistema. Este endpoint es **público** y **solo funciona si no existe ningún super administrador**. Una vez creado el primero, este endpoint dejará de funcionar.

**⚠️ IMPORTANTE:** Ejecuta la migración SQL primero antes de usar este endpoint.

**Body:**
```json
{
  "email": "admin@example.com",
  "name": "Super Admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "id": "user123",
  "email": "admin@example.com",
  "name": "Super Admin",
  "isSuperAdmin": true,
  "message": "Primer super administrador creado exitosamente",
  "createdAt": "2026-01-28T10:00:00.000Z"
}
```

**Ejemplo con cURL:**
```bash
curl --location --request POST 'http://localhost:3000/admin/first-super-admin' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "admin@example.com",
  "name": "Super Admin",
  "password": "password123"
}'
```

**Error si ya existe un super admin:**
```json
{
  "statusCode": 400,
  "message": "Ya existe un super administrador en el sistema. Usa el endpoint POST /admin/super-admin con autenticación para crear más."
}
```

---

### 2. Crear Super Administrador (Requiere Autenticación)

**POST** `/admin/super-admin`

Crea un nuevo super administrador. Solo los super administradores pueden crear otros super administradores.

**Requiere:** Autenticación y ser super administrador

**Body:**
```json
{
  "email": "admin2@example.com",
  "name": "Otro Super Admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "id": "user456",
  "email": "admin2@example.com",
  "name": "Otro Super Admin",
  "isSuperAdmin": true,
  "createdAt": "2026-01-28T10:00:00.000Z"
}
```

---

### 2. Obtener Métricas del Super Admin

**GET** `/admin/metrics`

Obtiene métricas generales del sistema.

**Response:**
```json
{
  "agencies": {
    "total": 50,
    "pending": 5,
    "approved": 40,
    "rejected": 5,
    "thisMonth": 10,
    "lastMonth": 8,
    "change": 25.0
  },
  "hosts": {
    "total": 30,
    "pending": 8,
    "approved": 20,
    "rejected": 2,
    "thisMonth": 5,
    "lastMonth": 3,
    "change": 66.7
  },
  "general": {
    "totalUsers": 1000,
    "totalTrips": 200,
    "totalExperiences": 150,
    "totalBookings": 500,
    "totalRevenue": 50000000
  },
  "pendingApprovals": {
    "agencies": 5,
    "hosts": 8,
    "total": 13
  }
}
```

---

### 3. Listar Todas las Agencias

**GET** `/admin/agencies`

Lista todas las agencias con filtros opcionales.

**Query Parameters:**
- `status` (opcional): `PENDING` | `APPROVED` | `REJECTED` | `ALL` (default: `ALL`)
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 20)

**Ejemplos:**
- `GET /admin/agencies` - Todas las agencias
- `GET /admin/agencies?status=PENDING` - Solo pendientes
- `GET /admin/agencies?status=APPROVED&page=1&limit=10` - Aprobadas con paginación

**Response:**
```json
{
  "data": [
    {
      "idAgency": "123",
      "nameAgency": "Agencia Ejemplo",
      "email": "agencia@example.com",
      "phone": "+57 300 123 4567",
      "nit": "123456789",
      "rntNumber": "RNT-123",
      "picture": "https://...",
      "status": "active",
      "approvalStatus": "APPROVED",
      "rejectionReason": null,
      "reviewedBy": "admin123",
      "reviewedAt": "2026-01-20T10:00:00.000Z",
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-01-20T10:00:00.000Z",
      "members": [...]
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  },
  "counts": {
    "pending": 5,
    "approved": 40,
    "rejected": 5,
    "all": 50
  }
}
```

---

### 4. Listar Agencias Pendientes

**GET** `/admin/agencies/pending`

Lista solo las agencias pendientes de aprobación.

---

### 5. Listar Agencias Aprobadas

**GET** `/admin/agencies/approved`

Lista solo las agencias aprobadas.

---

### 6. Listar Agencias Rechazadas

**GET** `/admin/agencies/rejected`

Lista solo las agencias rechazadas.

---

### 7. Aprobar una Agencia

**POST** `/admin/agencies/:agencyId/approve`

Aprueba una agencia pendiente.

**Response:**
```json
{
  "idAgency": "123",
  "nameAgency": "Agencia Ejemplo",
  "approvalStatus": "APPROVED",
  "reviewedBy": "admin123",
  "reviewedAt": "2026-01-28T10:00:00.000Z"
}
```

---

### 8. Rechazar una Agencia

**POST** `/admin/agencies/:agencyId/reject`

Rechaza una agencia pendiente.

**Body:**
```json
{
  "rejectionReason": "Documentación incompleta"
}
```

**Response:**
```json
{
  "idAgency": "123",
  "nameAgency": "Agencia Ejemplo",
  "approvalStatus": "REJECTED",
  "rejectionReason": "Documentación incompleta",
  "reviewedBy": "admin123",
  "reviewedAt": "2026-01-28T10:00:00.000Z"
}
```

---

### 9. Listar Todos los Hosts

**GET** `/admin/hosts`

Lista todos los hosts (usuarios con isHost: true) con filtros opcionales.

**Query Parameters:**
- `status` (opcional): `PENDING` | `APPROVED` | `REJECTED` | `ALL` (default: `ALL`)
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Elementos por página (default: 20)

**Ejemplos:**
- `GET /admin/hosts` - Todos los hosts
- `GET /admin/hosts?status=PENDING` - Solo pendientes
- `GET /admin/hosts?status=APPROVED&page=1&limit=10` - Aprobados con paginación

**Response:**
```json
{
  "data": [
    {
      "id": "user123",
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "phone": "+57 300 123 4567",
      "dni": "1234567890",
      "city": "Bogotá",
      "department": "Cundinamarca",
      "image": "https://...",
      "isHost": true,
      "approvalStatus": "PENDING",
      "rejectionReason": null,
      "reviewedBy": null,
      "reviewedAt": null,
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-01-15T10:00:00.000Z",
      "experiencesCount": 3,
      "recentExperiences": [...]
    }
  ],
  "pagination": {
    "total": 30,
    "page": 1,
    "limit": 20,
    "totalPages": 2
  },
  "counts": {
    "pending": 8,
    "approved": 20,
    "rejected": 2,
    "all": 30
  }
}
```

---

### 10. Listar Hosts Pendientes

**GET** `/admin/hosts/pending`

Lista solo los hosts pendientes de aprobación.

---

### 11. Listar Hosts Aprobados

**GET** `/admin/hosts/approved`

Lista solo los hosts aprobados.

---

### 12. Listar Hosts Rechazados

**GET** `/admin/hosts/rejected`

Lista solo los hosts rechazados.

---

### 13. Aprobar un Host

**POST** `/admin/hosts/:hostId/approve`

Aprueba un host pendiente. Una vez aprobado, el host podrá iniciar sesión y crear experiencias.

**Response:**
```json
{
  "id": "user123",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "isHost": true,
  "hostApprovalStatus": "APPROVED",
  "hostReviewedBy": "admin123",
  "hostReviewedAt": "2026-01-28T10:00:00.000Z"
}
```

---

### 14. Rechazar un Host

**POST** `/admin/hosts/:hostId/reject`

Rechaza un host pendiente. El host no podrá iniciar sesión hasta que sea aprobado.

**Body:**
```json
{
  "rejectionReason": "Documentación insuficiente o información sospechosa"
}
```

**Response:**
```json
{
  "id": "user123",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "isHost": true,
  "hostApprovalStatus": "REJECTED",
  "hostRejectionReason": "Documentación insuficiente o información sospechosa",
  "hostReviewedBy": "admin123",
  "hostReviewedAt": "2026-01-28T10:00:00.000Z"
}
```

---

## Notas Importantes

1. **Control de Acceso para Hosts:**
   - Los hosts con `hostApprovalStatus: PENDING` o `null` NO pueden iniciar sesión
   - Los hosts con `hostApprovalStatus: REJECTED` NO pueden iniciar sesión
   - Solo los hosts con `hostApprovalStatus: APPROVED` pueden iniciar sesión

2. **Creación de Hosts:**
   - Cuando un usuario se registra como host, automáticamente se establece `hostApprovalStatus: PENDING`
   - El host debe esperar la aprobación de un super administrador antes de poder iniciar sesión

3. **Super Administradores:**
   - Los super administradores pueden iniciar sesión independientemente de su estado de host
   - Solo los super administradores pueden crear otros super administradores

4. **Migración de Base de Datos:**
   - Ejecutar el script SQL: `prisma/scripts/add-host-approval-fields.sql`
   - O ejecutar: `npx prisma migrate dev --name add_host_approval_and_super_admin`
