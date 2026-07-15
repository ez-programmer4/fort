require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// [key, label, module]
const PERMISSIONS = [
  ['dashboard.view', 'View dashboard', 'Dashboard'],
  ['alerts.view', 'View alerts', 'Alerts'],
  ['locations.manage', 'Manage locations', 'Locations'],
  ['users.manage', 'Manage users', 'Users & Roles'],
  ['roles.manage', 'Manage roles & permissions', 'Users & Roles'],
  ['products.view', 'View products', 'Products'],
  ['products.manage', 'Add/edit products, import/export', 'Products'],
  ['inventory.view', 'View inventory & bin card', 'Inventory'],
  ['inventory.adjust', 'Make stock adjustments', 'Inventory'],
  ['suppliers.manage', 'Manage suppliers', 'Procurement'],
  ['procurement.view', 'View POs & GRV history', 'Procurement'],
  ['procurement.manage', 'Create POs & receive goods', 'Procurement'],
  ['sales.view', 'View sales history', 'Sales'],
  ['sales.dispense', 'Dispense / make sales', 'Sales'],
  ['finance.view', 'View wallet & balances', 'Finance'],
  ['finance.manage', 'Record payments, manage taxes', 'Finance'],
  ['reports.view', 'View & export reports', 'Reports'],
  ['settings.manage', 'Manage system settings', 'Settings'],
];

const ALL = PERMISSIONS.map(([key]) => key);

const ROLES = {
  Admin: { description: 'Full access to everything', isSystem: true, permissions: ALL },
  Accountant: {
    description: 'Finance, Reports, Wallet',
    isSystem: false,
    permissions: ['dashboard.view', 'alerts.view', 'finance.view', 'finance.manage', 'reports.view', 'sales.view'],
  },
  Operations: {
    description: 'Inventory, Procurement, Stock Adjustments',
    isSystem: false,
    permissions: [
      'dashboard.view', 'alerts.view', 'locations.manage',
      'products.view', 'products.manage',
      'inventory.view', 'inventory.adjust',
      'suppliers.manage', 'procurement.view', 'procurement.manage',
    ],
  },
  Sales: {
    description: 'Dispensing, Sales History',
    isSystem: false,
    permissions: ['dashboard.view', 'alerts.view', 'products.view', 'inventory.view', 'sales.view', 'sales.dispense'],
  },
};

const LOOKUPS = {
  doseForm: ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Cream', 'Ointment', 'Drops', 'Inhaler', 'Suppository', 'Gel', 'Lotion', 'Patch', 'Powder', 'Solution'],
  route: ['Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhalation', 'Rectal', 'Ophthalmic', 'Otic', 'Nasal', 'Sublingual'],
  doseUnit: ['mg', 'g', 'mcg', 'ml', 'IU', '%', 'mg/ml', 'mg/5ml'],
  unit: ['Box', 'Pack', 'Strip', 'Bottle', 'Vial', 'Ampoule', 'Tube', 'Piece', 'Carton', 'Sachet'],
};

async function main() {
  for (const [category, values] of Object.entries(LOOKUPS)) {
    for (const value of values) {
      await prisma.lookup.upsert({
        where: { category_value: { category, value } },
        update: {},
        create: { category, value },
      });
    }
  }

  for (const [key, label, module] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { label, module },
      create: { key, label, module },
    });
  }

  const permByKey = {};
  for (const p of await prisma.permission.findMany()) permByKey[p.key] = p.id;

  for (const [name, def] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { description: def.description, isSystem: def.isSystem },
      create: { name, description: def.description, isSystem: def.isSystem },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: def.permissions.map((key) => ({ roleId: role.id, permissionId: permByKey[key] })),
    });
  }

  const adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } });
  await prisma.user.upsert({
    where: { email: 'admin@fortinventory.local' },
    update: {},
    create: {
      fullName: 'System Administrator',
      email: 'admin@fortinventory.local',
      passwordHash: await bcrypt.hash('admin123', 10),
      roleId: adminRole.id,
    },
  });

  console.log('Seed complete: 18 permissions, 4 roles, admin user (admin@fortinventory.local / admin123)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
