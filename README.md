# 🏠 RentFlow API

Sistema de gestión de rentas y propiedades. Backend construido con NestJS, TypeScript, TypeORM y PostgreSQL.

## Requisitos previos

- **Node.js** >= 18
- **PostgreSQL** >= 14
- **npm** o **yarn**

## Instalación rápida

```bash
# 1. Instalar dependencias
npm install

# 2. Crear la base de datos en PostgreSQL
psql -U postgres -c "CREATE DATABASE rentflow_db;"
psql -U postgres -c "CREATE USER rentflow WITH PASSWORD 'tu_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE rentflow_db TO rentflow;"

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL

# 4. Ejecutar migraciones (cuando estén listas)
# npm run migration:run

# 5. Iniciar en modo desarrollo
npm run start:dev
```

## Endpoints disponibles

Una vez corriendo, visita:
- **API**: http://localhost:3000/api/v1
- **Swagger Docs**: http://localhost:3000/api/docs

### Auth
- `POST /api/v1/auth/register` - Registrar usuario
- `POST /api/v1/auth/login` - Iniciar sesión
- `POST /api/v1/auth/refresh` - Refrescar token

### Properties
- `GET /api/v1/properties` - Listar propiedades (con paginación y filtros)
- `GET /api/v1/properties/stats` - Estadísticas del dashboard
- `GET /api/v1/properties/:id` - Detalle de propiedad
- `POST /api/v1/properties` - Crear propiedad
- `PUT /api/v1/properties/:id` - Actualizar propiedad
- `DELETE /api/v1/properties/:id` - Eliminar propiedad

## Estructura del proyecto

```
src/
├── common/                  # Código compartido
│   ├── decorators/          # @CurrentUser, @Roles
│   ├── dto/                 # PaginatedResponse
│   ├── entities/            # BaseEntity
│   ├── filters/             # GlobalExceptionFilter
│   └── guards/              # RolesGuard
├── config/                  # Configuración y data source
├── database/
│   ├── migrations/          # Migraciones TypeORM
│   └── seeds/               # Datos iniciales
├── modules/
│   ├── auth/                # Autenticación JWT
│   ├── users/               # Entidad de usuarios
│   ├── properties/          # CRUD de propiedades ✅
│   ├── units/               # Unidades por propiedad
│   ├── tenants/             # Inquilinos
│   ├── leases/              # Contratos de alquiler
│   ├── payments/            # Pagos y cobros
│   └── maintenance/         # Solicitudes de mantenimiento
├── app.module.ts            # Módulo raíz
└── main.ts                  # Bootstrap de la app
```

## Scripts útiles

```bash
npm run start:dev          # Desarrollo con hot-reload
npm run build              # Compilar para producción
npm run start:prod         # Ejecutar en producción
npm run lint               # Linter
npm run test               # Tests unitarios
npm run migration:generate # Generar migración
npm run migration:run      # Ejecutar migraciones
```

## Stack tecnológico

- **Runtime**: Node.js + TypeScript
- **Framework**: NestJS 11
- **ORM**: TypeORM
- **DB**: PostgreSQL
- **Auth**: JWT + Passport
- **Docs**: Swagger/OpenAPI
- **Validación**: class-validator + class-transformer

## Próximos pasos

- [ ] Módulo de Units (CRUD)
- [ ] Módulo de Tenants (CRUD)
- [ ] Módulo de Leases (contratos)
- [ ] Módulo de Payments (pagos)
- [ ] Módulo de Maintenance (mantenimiento)
- [ ] Dashboard con métricas
- [ ] Generación de recibos PDF
- [ ] Notificaciones por email
- [ ] Frontend React
