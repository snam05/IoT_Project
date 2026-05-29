/**
 * Prisma Seed — creates default admin user + sample lockers
 * Run: npx prisma db seed
 */
import prisma from '../backend/lib/prisma.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

function generateTotpSecret() {
  return crypto.randomBytes(20).toString('base64');
}

async function main() {
  console.log('🌱 Seeding database...');

  // ── Create Admin user ──────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@1234', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@lockersystem.local',
      name: 'System Administrator',
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin user: admin / Admin@1234 (id: ${admin.id})`);

  // ── Create test user ───────────────────────────────────────
  const userHash = await bcrypt.hash('User@1234', 12);
  const testUser = await prisma.user.upsert({
    where: { username: 'testuser' },
    update: {},
    create: {
      username: 'testuser',
      email: 'user@lockersystem.local',
      name: 'Test User',
      passwordHash: userHash,
      role: 'USER',
    },
  });
  console.log(`✅ Test user: testuser / User@1234 (id: ${testUser.id})`);

  // ── Create sample lockers — Zone A (Ground Floor) 6×3 ─────
  const zones = [
    { zone: 'A', floor: 0, rows: 3, cols: 6 },
    { zone: 'B', floor: 1, rows: 2, cols: 4 },
  ];

  let lockerCount = 0;
  for (const { zone, floor, rows, cols } of zones) {
    for (let row = 1; row <= rows; row++) {
      for (let col = 1; col <= cols; col++) {
        const lockerId = `${zone}-${String((row - 1) * cols + col).padStart(3, '0')}`;
        await prisma.locker.upsert({
          where: { lockerId },
          update: {},
          create: {
            lockerId,
            zone,
            floor,
            row,
            col,
            status: 'AVAILABLE',
            totpSecret: generateTotpSecret(),
            description: `Zone ${zone} / Floor ${floor} / Row ${row} Col ${col}`,
          },
        });
        lockerCount++;
      }
    }
  }
  console.log(`✅ Created ${lockerCount} lockers`);

  // ── Assign test user to locker A-003 ──────────────────────
  await prisma.locker.update({
    where: { lockerId: 'A-003' },
    data: {
      status: 'IN_USE',
      userId: testUser.id,
      lockedAt: new Date(),
    },
  });
  console.log(`✅ Assigned A-003 to testuser`);

  // ── Set A-006 to MAINTENANCE ───────────────────────────────
  await prisma.locker.update({
    where: { lockerId: 'A-006' },
    data: { status: 'MAINTENANCE' },
  });
  console.log(`✅ A-006 set to MAINTENANCE`);

  console.log('\n🎉 Seed complete!');
  console.log('⚠️  IMPORTANT: Change admin and testuser passwords before production use!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
