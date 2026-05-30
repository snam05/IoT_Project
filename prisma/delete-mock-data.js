import prisma from '../backend/lib/prisma.js';

async function main() {
  console.log('🧹 Cleaning mock data (Zone A & Zone B) from database...');

  // 1. Find all mock lockers (those without a cabinetId)
  const mockLockers = await prisma.locker.findMany({
    where: { cabinetId: null },
    select: { lockerId: true }
  });
  
  const mockLockerIds = mockLockers.map(l => l.lockerId);

  // 2. Delete logs referencing these mock lockers
  if (mockLockerIds.length > 0) {
    const deletedLogs = await prisma.lockerLog.deleteMany({
      where: {
        lockerId: { in: mockLockerIds }
      }
    });
    console.log(`🗑️ Deleted ${deletedLogs.count} locker logs associated with mock lockers.`);
  }

  // 3. Delete the mock lockers themselves
  const deletedLockers = await prisma.locker.deleteMany({
    where: { cabinetId: null }
  });
  console.log(`🗑️ Deleted ${deletedLockers.count} mock lockers.`);

  console.log('✨ Database clean-up completed!');
}

main()
  .catch((e) => {
    console.error('❌ Clean-up failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
