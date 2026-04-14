/**
 * Database Seed Script
 *
 * Creates the initial platform admin and a demo tenant with sample data.
 * Run with: npm run db:seed
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding database...');

  // -------------------------------------------------------------------------
  // 1. Platform Admin
  // -------------------------------------------------------------------------
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL || 'admin@pbxplatform.com';
  const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD || 'Admin123!';
  const adminHash = await bcrypt.hash(adminPassword, 12);

  const platformAdmin = await prisma.platformAdmin.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: adminHash,
      name: 'Platform Admin',
      role: 'super_admin',
    },
  });
  console.log(`  Platform admin: ${platformAdmin.email}`);

  // -------------------------------------------------------------------------
  // 2. Demo Tenant: "Acme Corporation"
  // -------------------------------------------------------------------------
  const tenant1 = await prisma.tenant.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      plan: 'professional',
      maxExtensions: 50,
      maxPhoneNumbers: 10,
      brandName: 'Acme Corp',
      brandPrimaryColor: '#2563eb',
      brandSecondaryColor: '#1e40af',
    },
  });
  console.log(`  Tenant: ${tenant1.name} (${tenant1.slug})`);

  // Tenant admin user
  const tenantAdminHash = await bcrypt.hash('Password123!', 12);
  const tenantAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant1.id, email: 'admin@acmecorp.com' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      email: 'admin@acmecorp.com',
      password: tenantAdminHash,
      firstName: 'John',
      lastName: 'Admin',
      role: 'admin',
    },
  });
  console.log(`  Tenant admin: ${tenantAdmin.email}`);

  // Regular user
  const userHash = await bcrypt.hash('Password123!', 12);
  const user1 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant1.id, email: 'jane@acmecorp.com' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      email: 'jane@acmecorp.com',
      password: userHash,
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'user',
    },
  });

  // Extensions
  const ext100 = await prisma.extension.upsert({
    where: { tenantId_number: { tenantId: tenant1.id, number: '100' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      userId: tenantAdmin.id,
      number: '100',
      name: 'John Admin',
      type: 'sip',
      sipUsername: 'acme-corp_ext100',
      sipPassword: 'sip-pass-100-demo',
      voicemailEnabled: true,
      voicemailPin: '1234',
    },
  });

  const ext101 = await prisma.extension.upsert({
    where: { tenantId_number: { tenantId: tenant1.id, number: '101' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      userId: user1.id,
      number: '101',
      name: 'Jane Smith',
      type: 'sip',
      sipUsername: 'acme-corp_ext101',
      sipPassword: 'sip-pass-101-demo',
      voicemailEnabled: true,
      voicemailPin: '5678',
    },
  });

  const ext102 = await prisma.extension.upsert({
    where: { tenantId_number: { tenantId: tenant1.id, number: '102' } },
    update: {},
    create: {
      tenantId: tenant1.id,
      number: '102',
      name: 'Front Desk',
      type: 'sip',
      sipUsername: 'acme-corp_ext102',
      sipPassword: 'sip-pass-102-demo',
      voicemailEnabled: true,
    },
  });

  console.log(`  Extensions: 100, 101, 102`);

  // IVR Menu
  const mainIvr = await prisma.ivrMenu.upsert({
    where: { id: 'demo-ivr-main' },
    update: {},
    create: {
      id: 'demo-ivr-main',
      tenantId: tenant1.id,
      name: 'Main Menu',
      greetingType: 'tts',
      greetingText: 'Thank you for calling Acme Corporation. For sales, press 1. For support, press 2. For the company directory, press 3. To speak to the operator, press 0.',
      greetingVoice: 'Polly.Joanna',
      timeout: 5,
      maxRetries: 3,
      invalidMessage: 'That is not a valid option. Please try again.',
      timeoutMessage: 'We did not receive your selection.',
    },
  });

  // IVR Options
  const ivrOptions = [
    { digit: '1', label: 'Sales', actionType: 'extension', actionTarget: ext101.id },
    { digit: '2', label: 'Support', actionType: 'extension', actionTarget: ext102.id },
    { digit: '3', label: 'Directory', actionType: 'extension', actionTarget: ext100.id },
    { digit: '0', label: 'Operator', actionType: 'extension', actionTarget: ext100.id },
    { digit: '*', label: 'Repeat Menu', actionType: 'repeat', actionTarget: null },
  ];

  for (const opt of ivrOptions) {
    await prisma.ivrOption.upsert({
      where: { ivrMenuId_digit: { ivrMenuId: mainIvr.id, digit: opt.digit } },
      update: {},
      create: { ivrMenuId: mainIvr.id, ...opt },
    });
  }
  console.log(`  IVR Menu: ${mainIvr.name} with ${ivrOptions.length} options`);

  // Ring Group
  const salesGroup = await prisma.ringGroup.create({
    data: {
      tenantId: tenant1.id,
      name: 'Sales Team',
      strategy: 'simultaneous',
      ringTime: 25,
      members: {
        create: [
          { extensionId: ext100.id, priority: 1 },
          { extensionId: ext101.id, priority: 2 },
        ],
      },
    },
  });
  console.log(`  Ring Group: ${salesGroup.name}`);

  // Time Condition
  const businessHours = await prisma.timeCondition.create({
    data: {
      tenantId: tenant1.id,
      name: 'Business Hours',
      timezone: 'America/New_York',
      matchType: 'ivr',
      matchTarget: mainIvr.id,
      noMatchType: 'voicemail',
      noMatchTarget: ext100.id,
      schedules: {
        create: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
        ],
      },
    },
  });
  console.log(`  Time Condition: ${businessHours.name}`);

  // Contacts
  await prisma.contact.createMany({
    data: [
      { tenantId: tenant1.id, firstName: 'Bob', lastName: 'Customer', phone: '+15551234567', company: 'Customer Inc' },
      { tenantId: tenant1.id, firstName: 'Alice', lastName: 'Vendor', phone: '+15559876543', company: 'Vendor LLC' },
    ],
    skipDuplicates: true,
  });
  console.log(`  Contacts: 2 created`);

  // -------------------------------------------------------------------------
  // 3. Demo Tenant 2: "Springfield Medical"
  // -------------------------------------------------------------------------
  const tenant2 = await prisma.tenant.upsert({
    where: { slug: 'springfield-medical' },
    update: {},
    create: {
      name: 'Springfield Medical Center',
      slug: 'springfield-medical',
      plan: 'enterprise',
      maxExtensions: 100,
      maxPhoneNumbers: 20,
      brandName: 'Springfield Medical',
      brandPrimaryColor: '#059669',
      brandSecondaryColor: '#047857',
    },
  });

  const smcAdminHash = await bcrypt.hash('Password123!', 12);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant2.id, email: 'admin@springfieldmed.com' } },
    update: {},
    create: {
      tenantId: tenant2.id,
      email: 'admin@springfieldmed.com',
      password: smcAdminHash,
      firstName: 'Sarah',
      lastName: 'Director',
      role: 'admin',
    },
  });

  await prisma.extension.upsert({
    where: { tenantId_number: { tenantId: tenant2.id, number: '200' } },
    update: {},
    create: {
      tenantId: tenant2.id,
      number: '200',
      name: 'Reception',
      type: 'sip',
      sipUsername: 'springfield-med_ext200',
      sipPassword: 'sip-pass-200-demo',
      voicemailEnabled: true,
    },
  });

  await prisma.extension.upsert({
    where: { tenantId_number: { tenantId: tenant2.id, number: '201' } },
    update: {},
    create: {
      tenantId: tenant2.id,
      number: '201',
      name: 'Dr. Williams',
      type: 'sip',
      sipUsername: 'springfield-med_ext201',
      sipPassword: 'sip-pass-201-demo',
      voicemailEnabled: true,
    },
  });

  console.log(`  Tenant: ${tenant2.name} (${tenant2.slug}) with 2 extensions`);

  console.log('\nSeed completed successfully!');
  console.log('\n--- Login Credentials ---');
  console.log(`Platform Admin:   ${adminEmail} / ${adminPassword}`);
  console.log(`Acme Corp Admin:  admin@acmecorp.com / Password123!  (tenant: acme-corp)`);
  console.log(`Acme Corp User:   jane@acmecorp.com / Password123!  (tenant: acme-corp)`);
  console.log(`Springfield Med:  admin@springfieldmed.com / Password123!  (tenant: springfield-medical)`);
}

seed()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error('Seed error:', err);
    prisma.$disconnect();
    process.exit(1);
  });
