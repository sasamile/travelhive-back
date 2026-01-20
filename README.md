# Travel App Backend

Backend para aplicación de viajes construido con NestJS, Prisma ORM y arquitectura hexagonal.

## Estructura del Proyecto

El proyecto sigue una arquitectura hexagonal (puertos y adaptadores) organizada en las siguientes capas:

```
src/
├── domain/           # Capa de dominio (entidades y puertos/interfaces)
│   ├── entities/     # Entidades de dominio
│   └── ports/        # Interfaces/puertos para repositorios
├── application/      # Capa de aplicación (casos de uso)
│   └── use-cases/    # Casos de uso de negocio
├── infrastructure/   # Capa de infraestructura (implementaciones técnicas)
│   ├── database/     # Configuración de Prisma
│   └── repositories/ # Implementaciones de repositorios
└── presentation/     # Capa de presentación (controladores y DTOs)
    ├── controllers/  # Controladores REST
    └── dto/          # Data Transfer Objects
```

## Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/travelapp?schema=public"
PORT=3000
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=http://localhost:3000
```

### Base de Datos

1. Asegúrate de tener PostgreSQL instalado y corriendo.

2. **Genera el schema de Better Auth** (esto agregará las tablas de sesión automáticamente):

```bash
npx @better-auth/cli@latest generate
```

3. Ejecuta las migraciones de Prisma:

```bash
npm run prisma:migrate
```

4. Genera el cliente de Prisma:

```bash
npm run prisma:generate
```

**Nota importante**: Better Auth maneja automáticamente las tablas de sesión (`session`, `account`, `verification`). El comando `generate` del CLI de Better Auth agregará estas tablas a tu `schema.prisma`. No necesitas crear estas tablas manualmente.

## Instalación

```bash
npm install
```

## Desarrollo

```bash
# Desarrollo con hot-reload
npm run start:dev

# Generar cliente de Prisma
npm run prisma:generate

# Crear migración
npm run prisma:migrate

# Abrir Prisma Studio
npm run prisma:studio
```

## Endpoints

### Autenticación con Better Auth

Better Auth proporciona endpoints automáticos bajo `/api/auth/*`. Algunos ejemplos:

#### Registrar Usuario (Email/Password)
```
POST /api/auth/sign-up/email
Content-Type: application/json

{
  "email": "usuario@example.com",
  "password": "password123",
  "name": "Juan Pérez"
}
```

#### Iniciar Sesión
```
POST /api/auth/sign-in/email
Content-Type: application/json

{
  "email": "usuario@example.com",
  "password": "password123"
}
```

#### Obtener Sesión Actual
```
GET /api/auth/get-session
```

#### Obtener Perfil del Usuario Autenticado
```
GET /auth/me
```

#### Cerrar Sesión
```
POST /api/auth/sign-out
```

**Nota**: Better Auth maneja automáticamente las cookies de sesión. Todos los endpoints de autenticación están disponibles bajo `/api/auth/*`. Ver la [documentación oficial de Better Auth](https://www.better-auth.com/docs) para más detalles.

## Características

- ✅ Arquitectura hexagonal completa
- ✅ Prisma ORM con PostgreSQL
- ✅ Better Auth integrado para manejo automático de sesiones
- ✅ Autenticación con email/password
- ✅ Validación de datos con class-validator
- ✅ Manejo automático de tablas de sesión (`session`, `account`, `verification`)
- ✅ Integración con NestJS usando `@thallesp/nestjs-better-auth`

## Próximos Pasos

- [ ] Implementar registro de agencias usando Better Auth
- [ ] Implementar gestión de usuarios por agencia
- [ ] Agregar permisos y roles personalizados
- [ ] Implementar CRUD de viajes y expediciones
- [ ] Configurar social providers (Google, GitHub, etc.) si es necesario
