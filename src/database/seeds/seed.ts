import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as bcrypt from 'bcrypt';
import * as path from 'path';

// Load .env before anything else
config({ path: path.resolve(process.cwd(), '.env') });

// ─── Entity imports ───────────────────────────────────────────────────────────
import { User } from '@/modules/users/entities/user.entity';
import { Property, PropertyType } from '@/modules/properties/entities/property.entity';
import { Unit, UnitStatus } from '@/modules/units/entities/unit.entity';
import { Tenant } from '@/modules/tenants/entities/tenant.entity';
import { Lease, LeaseStatus } from '@/modules/leases/entities/lease.entity';
import { Payment, PaymentStatus, PaymentMethod } from '@/modules/payments/entities/payment.entity';
import {
  MaintenanceRequest,
  MaintenancePriority,
  MaintenanceStatus,
} from '@/modules/maintenance/entities/maintenance-request.entity';

// ─── DataSource ───────────────────────────────────────────────────────────────
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'rentflow_db',
  entities: [User, Property, Unit, Tenant, Lease, Payment, MaintenanceRequest],
  synchronize: true,
  logging: false,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD string for a date offset by months from today */
function monthsAgo(n: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d;
}

/** Build a due date using paymentDay in a given month/year */
function dueDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, lastDay));
}

// ─── Seed ─────────────────────────────────────────────────────────────────────
async function seed() {
  await AppDataSource.initialize();
  console.log('✅ Connected to database');

  // ── 1. Clean existing data (reverse dependency order) ──────────────────────
  await AppDataSource.query('TRUNCATE TABLE maintenance_requests CASCADE');
  await AppDataSource.query('TRUNCATE TABLE payments CASCADE');
  await AppDataSource.query('TRUNCATE TABLE leases CASCADE');
  await AppDataSource.query('TRUNCATE TABLE units CASCADE');
  await AppDataSource.query('TRUNCATE TABLE tenants CASCADE');
  await AppDataSource.query('TRUNCATE TABLE properties CASCADE');
  await AppDataSource.query('TRUNCATE TABLE users CASCADE');
  console.log('🗑  Existing data cleared');

  const userRepo = AppDataSource.getRepository(User);
  const propertyRepo = AppDataSource.getRepository(Property);
  const unitRepo = AppDataSource.getRepository(Unit);
  const tenantRepo = AppDataSource.getRepository(Tenant);
  const leaseRepo = AppDataSource.getRepository(Lease);
  const paymentRepo = AppDataSource.getRepository(Payment);
  const maintenanceRepo = AppDataSource.getRepository(MaintenanceRequest);

  // ── 2. User ─────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin123!', 12);
  const user = userRepo.create({
    email: 'admin@rentflow.hn',
    passwordHash,
    firstName: 'Carlos',
    lastName: 'Admin',
    phone: '+504 9999-0001',
    isActive: true,
  });
  await userRepo.save(user);
  console.log('👤 User created');

  // ── 3. Properties ───────────────────────────────────────────────────────────
  const [propResidencial, propApartamentos, propComercial] = await propertyRepo.save([
    propertyRepo.create({
      ownerId: user.id,
      name: 'Residencial Las Palmas',
      address: 'Col. Las Palmas, Calle Principal #215',
      city: 'Tegucigalpa',
      state: 'Francisco Morazán',
      type: PropertyType.HOUSE,
      notes: 'Conjunto residencial cerrado con vigilancia 24h.',
    }),
    propertyRepo.create({
      ownerId: user.id,
      name: 'Edificio Morazán',
      address: 'Col. Palmira, Ave. República de Chile #1010',
      city: 'Tegucigalpa',
      state: 'Francisco Morazán',
      type: PropertyType.APARTMENT,
      notes: 'Edificio de 4 pisos, 12 apartamentos en total.',
    }),
    propertyRepo.create({
      ownerId: user.id,
      name: 'Plaza Comercial Kennedy',
      address: 'Blvd. Fuerzas Armadas, frente a Mall Kennedy',
      city: 'Tegucigalpa',
      state: 'Francisco Morazán',
      type: PropertyType.COMMERCIAL,
      notes: 'Local comercial en zona de alto tráfico.',
    }),
  ]);
  console.log('🏠 Properties created (3)');

  // ── 4. Units ─────────────────────────────────────────────────────────────────
  const units = await unitRepo.save([
    // Residencial Las Palmas — 3 casas
    unitRepo.create({
      propertyId: propResidencial.id,
      unitNumber: 'Casa 1',
      bedrooms: 3,
      bathrooms: 2,
      areaSqm: 120,
      baseRent: 12000,
      status: UnitStatus.OCCUPIED,
      description: 'Casa de 1 planta, jardín frontal',
    }),
    unitRepo.create({
      propertyId: propResidencial.id,
      unitNumber: 'Casa 2',
      bedrooms: 3,
      bathrooms: 2,
      areaSqm: 115,
      baseRent: 11500,
      status: UnitStatus.OCCUPIED,
      description: 'Casa de 1 planta, cochera doble',
    }),
    unitRepo.create({
      propertyId: propResidencial.id,
      unitNumber: 'Casa 3',
      bedrooms: 2,
      bathrooms: 1,
      areaSqm: 90,
      baseRent: 9000,
      status: UnitStatus.AVAILABLE,
      description: 'Casa pequeña, recientemente pintada',
    }),
    // Edificio Morazán — 3 apartamentos
    unitRepo.create({
      propertyId: propApartamentos.id,
      unitNumber: 'Apto 1-A',
      bedrooms: 2,
      bathrooms: 1,
      areaSqm: 75,
      baseRent: 8500,
      status: UnitStatus.OCCUPIED,
      description: 'Primer piso, vista interior',
    }),
    unitRepo.create({
      propertyId: propApartamentos.id,
      unitNumber: 'Apto 2-B',
      bedrooms: 2,
      bathrooms: 2,
      areaSqm: 80,
      baseRent: 9500,
      status: UnitStatus.OCCUPIED,
      description: 'Segundo piso, balcón',
    }),
    unitRepo.create({
      propertyId: propApartamentos.id,
      unitNumber: 'Apto 3-A',
      bedrooms: 1,
      bathrooms: 1,
      areaSqm: 55,
      baseRent: 6500,
      status: UnitStatus.MAINTENANCE,
      description: 'Tercer piso, en reparación de techo',
    }),
    // Plaza Comercial — 2 locales
    unitRepo.create({
      propertyId: propComercial.id,
      unitNumber: 'Local 01',
      bedrooms: 0,
      bathrooms: 1,
      areaSqm: 40,
      baseRent: 18000,
      status: UnitStatus.AVAILABLE,
      description: 'Local esquinero, alta visibilidad',
    }),
    unitRepo.create({
      propertyId: propComercial.id,
      unitNumber: 'Local 02',
      bedrooms: 0,
      bathrooms: 1,
      areaSqm: 35,
      baseRent: 15000,
      status: UnitStatus.OCCUPIED,
      description: 'Local interior, actualmente tienda de ropa',
    }),
  ]);
  console.log('🏢 Units created (8)');

  // Named references for clarity
  const [casa1, casa2, , apto1A, apto2B, , , local02] = units;

  // ── 5. Tenants ───────────────────────────────────────────────────────────────
  const [tenant1, tenant2, tenant3, tenant4, tenant5] = await tenantRepo.save([
    tenantRepo.create({
      ownerId: user.id,
      firstName: 'María',
      lastName: 'Rodríguez Flores',
      email: 'maria.rodriguez@gmail.com',
      phone: '+504 9888-1122',
      idNumber: '0801-1985-03421',
      emergencyContact: 'José Rodríguez',
      emergencyPhone: '+504 9777-5566',
      notes: 'Inquilina puntual, trabaja en BANHPROVI.',
    }),
    tenantRepo.create({
      ownerId: user.id,
      firstName: 'Luis',
      lastName: 'Mejía Andrade',
      email: 'luis.mejia@outlook.com',
      phone: '+504 9766-3344',
      idNumber: '0801-1990-07812',
      emergencyContact: 'Ana Mejía',
      emergencyPhone: '+504 9655-2211',
      notes: 'Contador. Referencias verificadas.',
    }),
    tenantRepo.create({
      ownerId: user.id,
      firstName: 'Ana',
      lastName: 'Zelaya Cruz',
      email: 'ana.zelaya@yahoo.com',
      phone: '+504 9544-6677',
      idNumber: '0801-1988-15234',
      emergencyContact: 'Pedro Zelaya',
      emergencyPhone: '+504 9433-8899',
      notes: 'Médica en Hospital Escuela.',
    }),
    tenantRepo.create({
      ownerId: user.id,
      firstName: 'Roberto',
      lastName: 'Aguilar Pineda',
      email: 'r.aguilar@empresa.hn',
      phone: '+504 9322-9900',
      idNumber: '0801-1978-22345',
      emergencyContact: 'Carmen Aguilar',
      emergencyPhone: '+504 9211-0011',
      notes: 'Empresario. RTN: 08011978223456.',
    }),
    tenantRepo.create({
      ownerId: user.id,
      firstName: 'Sofía',
      lastName: 'Murillo Lagos',
      email: 'sofia.murillo@unah.hn',
      phone: '+504 9100-2233',
      idNumber: '0801-1995-31456',
      notes: 'Docente universitaria.',
    }),
  ]);
  console.log('👥 Tenants created (5)');

  // ── 6. Leases ────────────────────────────────────────────────────────────────
  const leaseStart = new Date('2025-04-01');
  const leaseEnd = new Date('2026-03-31');

  const [lease1, lease2, lease3, lease4] = await leaseRepo.save([
    leaseRepo.create({
      unitId: casa1.id,
      tenantId: tenant1.id,
      startDate: leaseStart as any,
      endDate: leaseEnd as any,
      monthlyRent: 12000,
      paymentDay: 1,
      depositAmount: 24000,
      status: LeaseStatus.ACTIVE,
      terms: 'No se permiten mascotas. Incluye agua.',
    }),
    leaseRepo.create({
      unitId: casa2.id,
      tenantId: tenant2.id,
      startDate: leaseStart as any,
      endDate: leaseEnd as any,
      monthlyRent: 11500,
      paymentDay: 5,
      depositAmount: 23000,
      status: LeaseStatus.ACTIVE,
      terms: 'No se permite subarrendar.',
    }),
    leaseRepo.create({
      unitId: apto1A.id,
      tenantId: tenant3.id,
      startDate: leaseStart as any,
      endDate: leaseEnd as any,
      monthlyRent: 8500,
      paymentDay: 1,
      depositAmount: 17000,
      status: LeaseStatus.ACTIVE,
    }),
    leaseRepo.create({
      unitId: apto2B.id,
      tenantId: tenant4.id,
      startDate: new Date('2025-06-01') as any,
      endDate: new Date('2026-05-31') as any,
      monthlyRent: 9500,
      paymentDay: 10,
      depositAmount: 19000,
      status: LeaseStatus.ACTIVE,
      terms: 'Incluye estacionamiento.',
    }),
  ]);

  // Lease for local02 with tenant5 (no payments needed — just to have variety)
  await leaseRepo.save(
    leaseRepo.create({
      unitId: local02.id,
      tenantId: tenant5.id,
      startDate: new Date('2025-10-01') as any,
      endDate: new Date('2026-09-30') as any,
      monthlyRent: 15000,
      paymentDay: 1,
      depositAmount: 30000,
      status: LeaseStatus.ACTIVE,
      terms: 'Local comercial. Pago por transferencia bancaria.',
    }),
  );

  console.log('📄 Leases created (5)');

  // ── 7. Payments ──────────────────────────────────────────────────────────────
  // Current month: March 2026 (today = 2026-03-27)
  // 3 months back: January, February, March 2026
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-based

  type PaymentSeed = {
    leaseId: string;
    paymentDay: number;
    monthlyRent: number;
  };

  const leasesToPay: PaymentSeed[] = [
    { leaseId: lease1.id, paymentDay: 1, monthlyRent: 12000 },
    { leaseId: lease2.id, paymentDay: 5, monthlyRent: 11500 },
    { leaseId: lease3.id, paymentDay: 1, monthlyRent: 8500 },
    { leaseId: lease4.id, paymentDay: 10, monthlyRent: 9500 },
  ];

  const payments: Partial<Payment>[] = [];

  for (const ls of leasesToPay) {
    for (let offset = 2; offset >= 0; offset--) {
      let month = currentMonth - offset;
      let year = currentYear;
      if (month <= 0) {
        month += 12;
        year -= 1;
      }

      const due = dueDate(year, month, ls.paymentDay);
      const isPast = due < now;

      // Pattern: 2 months ago = paid, 1 month ago = mixed, current month = pending
      let status: PaymentStatus;
      let paidDate: Date | null = null;
      let method: PaymentMethod | null = null;
      let referenceNumber: string | null = null;

      if (offset === 2) {
        // Oldest month → paid
        status = PaymentStatus.PAID;
        paidDate = new Date(due);
        paidDate.setDate(paidDate.getDate() + 2);
        method = PaymentMethod.TRANSFER;
        referenceNumber = `TRF-${year}${String(month).padStart(2, '0')}-${ls.leaseId.slice(0, 4).toUpperCase()}`;
      } else if (offset === 1) {
        // Middle month → paid for leases 1 & 3, overdue for leases 2 & 4
        if (ls.leaseId === lease1.id || ls.leaseId === lease3.id) {
          status = PaymentStatus.PAID;
          paidDate = new Date(due);
          paidDate.setDate(paidDate.getDate() + 1);
          method = PaymentMethod.CASH;
        } else {
          // Due date has passed and not paid → overdue
          status = isPast ? PaymentStatus.OVERDUE : PaymentStatus.PENDING;
        }
      } else {
        // Current month → pending
        status = PaymentStatus.PENDING;
      }

      const payment: Partial<Payment> = {
        leaseId: ls.leaseId,
        amount: ls.monthlyRent as any,
        dueDate: due as any,
        status,
      };

      if (paidDate) payment.paidDate = paidDate as any;
      if (method) payment.method = method;
      if (referenceNumber) payment.referenceNumber = referenceNumber;

      payments.push(payment);
    }
  }

  await paymentRepo.save(payments as Payment[]);
  console.log(`💳 Payments created (${payments.length})`);

  // ── 8. Maintenance requests ───────────────────────────────────────────────────
  await maintenanceRepo.save([
    maintenanceRepo.create({
      unitId: apto1A.id,
      tenantId: tenant3.id,
      title: 'Fuga de agua en baño principal',
      description: 'El grifo del lavabo tiene una fuga constante que está mojando el gabinete inferior. El inquilino reportó el problema hace 2 días.',
      priority: MaintenancePriority.HIGH,
      status: MaintenanceStatus.IN_PROGRESS,
      estimatedCost: 850,
      resolutionNotes: 'Plomero asignado, pendiente de compra de repuestos.',
    }),
    maintenanceRepo.create({
      unitId: units[5].id, // Apto 3-A (in maintenance status)
      title: 'Reparación de techo — filtración de agua',
      description: 'Filtración en el techo del cuarto principal. Se detectó humedad en la pared norte. Requiere impermeabilización completa.',
      priority: MaintenancePriority.URGENT,
      status: MaintenanceStatus.OPEN,
      estimatedCost: 15000,
    }),
    maintenanceRepo.create({
      unitId: casa1.id,
      tenantId: tenant1.id,
      title: 'Cambio de foco en área de lavandería',
      description: 'El foco del área de lavandería exterior se quemó. Solicitar cambio por LED equivalente.',
      priority: MaintenancePriority.LOW,
      status: MaintenanceStatus.COMPLETED,
      estimatedCost: 150,
      actualCost: 120,
      completedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      resolutionNotes: 'Foco LED instalado. Costo final L. 120 incluyendo mano de obra.',
    }),
  ]);
  console.log('🔧 Maintenance requests created (3)');

  // ── Done ─────────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('  ✅  SEED COMPLETADO EXITOSAMENTE');
  console.log('════════════════════════════════════════');
  console.log('  Credenciales del usuario de prueba:');
  console.log('  Email   : admin@rentflow.hn');
  console.log('  Password: Admin123!');
  console.log('  Rol     : owner');
  console.log('════════════════════════════════════════\n');

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
