# RentFlow — Sistema de Gestión de Rentas y Propiedades

## Visión del proyecto

RentFlow es una aplicación web responsive para gestionar propiedades de alquiler. Comenzó como herramienta personal y está diseñada para escalar a SaaS multi-tenant en el futuro. El mercado inicial es Honduras (Tegucigalpa), por lo que debe soportar Lempiras, identidades/RTN hondureños, y comunicación por WhatsApp.

## Stack tecnológico

- **Backend**: NestJS 11 + TypeScript (monolito modular)
- **ORM**: TypeORM con PostgreSQL
- **Auth**: JWT + Passport (access token + refresh token)
- **Documentación**: Swagger/OpenAPI en `/api/docs`
- **Frontend** (por construir): React 18+ con TypeScript, Tailwind CSS, React Query, React Hook Form + Zod
- **Prefijo API**: `/api/v1`

## Arquitectura y patrones

### Estructura de módulos
Cada módulo sigue este patrón consistente:
```
src/modules/{nombre}/
├── dto/                 # DTOs con class-validator para input/output
├── entities/            # Entidades TypeORM
├── {nombre}.controller.ts  # Endpoints REST con decoradores Swagger
├── {nombre}.service.ts     # Lógica de negocio
└── {nombre}.module.ts      # Registro del módulo NestJS
```

### Convenciones de código
- Todas las entidades extienden `BaseEntity` (src/common/entities/base.entity.ts) que provee `id` (UUID), `createdAt`, `updatedAt`
- Los IDs son UUIDs generados automáticamente (preparado para multi-tenant)
- Usar `@CurrentUser()` decorator para obtener el usuario autenticado
- Usar `@Roles()` decorator + `RolesGuard` para control de acceso
- Todos los endpoints protegidos usan `@UseGuards(JwtAuthGuard)`
- Los controladores usan `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth` para Swagger
- DTOs usan `class-validator` para validación y `@nestjs/swagger` para documentación
- Las queries paginadas retornan `PaginatedResponseDto<T>` (src/common/dto/paginated-response.dto.ts)
- Los nombres de columnas en la DB usan snake_case, las propiedades en TypeScript usan camelCase
- Filtrado por ownership: cada query de lectura filtra por `ownerId` del usuario autenticado
- Los campos monetarios usan `decimal(12,2)` para manejar Lempiras con centavos

### Path aliases
- `@/*` → `src/*`
- `@common/*` → `src/common/*`
- `@modules/*` → `src/modules/*`
- `@config/*` → `src/config/*`

## Modelo de datos (7 entidades)

### Users
Propietarios del sistema. Campos: email (unique), passwordHash, firstName, lastName, phone, role (owner|admin|viewer), isActive.

### Properties
Inmuebles del propietario. Campos: name, address, city, state, zipCode, latitude, longitude, type (house|apartment|commercial|land), notes. Relación: belongsTo User, hasMany Units.

### Units
Unidades rentables dentro de una propiedad. Campos: unitNumber, areaSqm, bedrooms, bathrooms, baseRent, status (available|occupied|maintenance), description. Relación: belongsTo Property, hasMany Leases, hasMany MaintenanceRequests.

### Tenants
Inquilinos. Campos: firstName, lastName, email, phone, idNumber (identidad/RTN), emergencyContact, emergencyPhone, notes. Relación: hasMany Leases, hasMany MaintenanceRequests.

### Leases (Contratos)
Contratos de alquiler que conectan Unit con Tenant. Campos: startDate, endDate, monthlyRent, paymentDay, depositAmount, status (pending|active|expired|terminated), terms, contractUrl. Relación: belongsTo Unit, belongsTo Tenant, hasMany Payments.

### Payments
Pagos de renta. Campos: amount, dueDate, paidDate, status (pending|paid|overdue|partial), method (cash|transfer|card|other), referenceNumber, receiptUrl, notes. Relación: belongsTo Lease.

### MaintenanceRequests
Solicitudes de mantenimiento. Campos: title, description, priority (low|medium|high|urgent), status (open|in_progress|completed|cancelled), estimatedCost, actualCost, completedAt, resolutionNotes. Relación: belongsTo Unit, belongsTo Tenant (nullable).

## Estado actual del desarrollo

### ✅ Completado
- Estructura del proyecto y configuración (TypeORM, ConfigModule, Swagger)
- Entidades de las 7 tablas con relaciones
- Módulo Auth completo (register, login, refresh token)
- Módulo Properties completo (CRUD + stats + paginación + filtros)
- BaseEntity, PaginatedResponseDto, GlobalExceptionFilter
- Decoradores: @CurrentUser, @Roles
- Guards: JwtAuthGuard, RolesGuard

### 🔨 Próximo a construir (en este orden)
1. Módulo Units (CRUD, filtrado por propiedad)
2. Módulo Tenants (CRUD, búsqueda)
3. Módulo Leases (CRUD, cambio automático de status de Unit)
4. Módulo Payments (CRUD, tracking de morosidad)
5. Módulo Maintenance (CRUD, flujo de estados)
6. Migraciones TypeORM
7. Seed de datos de prueba

### 🔮 Futuro
- Frontend React
- Dashboard con métricas (ocupación, ingresos, morosidad)
- Generación de recibos PDF
- Notificaciones por email y push
- Firma electrónica de contratos
- Cobros automáticos (Stripe)
- Portal self-service para inquilinos
- Multi-tenant para SaaS
- Integración con WhatsApp

## Comandos útiles

```bash
npm run start:dev          # Desarrollo con hot-reload
npm run build              # Compilar para producción
npm run migration:generate # Generar migración
npm run migration:run      # Ejecutar migraciones
npm run seed:run           # Ejecutar seeds
```

## Instrucciones para Claude Code

- Al crear nuevos módulos, seguir EXACTAMENTE el patrón del módulo Properties (controller, service, module, dto, entity)
- Siempre agregar decoradores Swagger en controllers y DTOs
- Siempre filtrar datos por el usuario autenticado (ownership)
- Usar QueryBuilder de TypeORM para queries complejas con filtros
- Registrar cada nuevo módulo en app.module.ts
- Mantener consistencia en nomenclatura y estructura
- Los mensajes de error y documentación Swagger pueden estar en inglés
- Comentarios en código en inglés
