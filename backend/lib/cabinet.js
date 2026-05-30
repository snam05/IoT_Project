import prisma from './prisma.js';
import { generateTotpSecret } from './otp.js';

const CODE_RE = /^[A-Z0-9_-]{1,50}$/;

export function normalizeCabinetCode(value) {
  return String(value || '').trim().toUpperCase();
}

export function buildCabinetIdentity(cabinetCode, compartmentCount) {
  return `${normalizeCabinetCode(cabinetCode)}:${Number(compartmentCount)}`;
}

export function buildLockerId(cabinetCode, compartmentNo) {
  return `${normalizeCabinetCode(cabinetCode)}:${Number(compartmentNo)}`;
}

export function parseLockerId(lockerId) {
  const [cabinetCode, compartmentNo] = String(lockerId || '').split(':');
  const parsed = Number(compartmentNo);
  if (!cabinetCode || !Number.isInteger(parsed) || parsed < 1) return null;
  return { cabinetCode: normalizeCabinetCode(cabinetCode), compartmentNo: parsed };
}

export function validateCabinetPayload({ cabinetCode, compartmentCount }) {
  const normalizedCode = normalizeCabinetCode(cabinetCode);
  const count = Number(compartmentCount);
  if (!CODE_RE.test(normalizedCode)) {
    return { error: 'Invalid cabinetCode. Use A-Z, 0-9, _ or -, max 50 chars.' };
  }
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    return { error: 'compartmentCount must be an integer between 1 and 200.' };
  }
  return { cabinetCode: normalizedCode, compartmentCount: count };
}

export async function recordCabinetHello(input) {
  const valid = validateCabinetPayload(input);
  if (valid.error) return { status: 'INVALID', message: valid.error };

  const { cabinetCode, compartmentCount } = valid;
  const receivedIdentity = buildCabinetIdentity(cabinetCode, compartmentCount);
  const now = new Date();

  let existing = await prisma.cabinet.findUnique({ where: { cabinetCode } });
  if (!existing) {
    try {
      const cabinet = await prisma.cabinet.create({
        data: {
          cabinetCode,
          identity: receivedIdentity,
          compartmentCount,
          status: 'PENDING',
          lastSeenAt: now,
        },
      });
      return {
        status: 'PENDING',
        cabinet,
        receivedIdentity,
        message: 'Cabinet is waiting for admin approval.',
      };
    } catch (err) {
      if (err.code === 'P2002') {
        existing = await prisma.cabinet.findUnique({ where: { cabinetCode } });
        if (!existing) throw err;
      } else {
        throw err;
      }
    }
  }

  await prisma.cabinet.update({ where: { id: existing.id }, data: { lastSeenAt: now } });

  if (existing.compartmentCount !== compartmentCount || existing.identity !== receivedIdentity) {
    return {
      status: 'MISMATCH',
      cabinet: existing,
      receivedIdentity,
      expectedIdentity: existing.identity,
      message: 'Cabinet code exists but compartment count differs. Admin must delete the cabinet in DB, then reset the ESP32 so it can register again.',
    };
  }

  if (existing.status === 'APPROVED') {
    const lockers = await prisma.locker.findMany({
      where: { cabinetId: existing.id },
      select: { compartmentNo: true, status: true },
    });
    return { status: 'APPROVED', cabinet: existing, receivedIdentity, lockers, message: 'Cabinet approved.' };
  }

  return {
    status: existing.status,
    cabinet: existing,
    receivedIdentity,
    message: existing.status === 'REJECTED' ? 'Cabinet registration was rejected.' : 'Cabinet is waiting for admin approval.',
  };
}

export async function approveCabinet(cabinetId) {
  const id = Number(cabinetId);
  const cabinet = await prisma.cabinet.findUnique({ where: { id } });
  if (!cabinet) return null;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.cabinet.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), rejectedAt: null },
    });

    for (let compartmentNo = 1; compartmentNo <= cabinet.compartmentCount; compartmentNo++) {
      await tx.locker.upsert({
        where: { lockerId: buildLockerId(cabinet.cabinetCode, compartmentNo) },
        update: {
          cabinetId: cabinet.id,
          compartmentNo,
          zone: cabinet.cabinetCode.slice(0, 10),
          row: Math.ceil(compartmentNo / 10),
          col: ((compartmentNo - 1) % 10) + 1,
          description: `Cabinet ${cabinet.cabinetCode} compartment ${compartmentNo}`,
        },
        create: {
          lockerId: buildLockerId(cabinet.cabinetCode, compartmentNo),
          zone: cabinet.cabinetCode.slice(0, 10),
          floor: 0,
          row: Math.ceil(compartmentNo / 10),
          col: ((compartmentNo - 1) % 10) + 1,
          status: 'AVAILABLE',
          totpSecret: generateTotpSecret(),
          cabinetId: cabinet.id,
          compartmentNo,
          description: `Cabinet ${cabinet.cabinetCode} compartment ${compartmentNo}`,
        },
      });
    }

    return updated;
  });
}

export async function rejectCabinet(cabinetId) {
  const id = Number(cabinetId);
  return prisma.cabinet.update({
    where: { id },
    data: { status: 'REJECTED', rejectedAt: new Date(), approvedAt: null },
  });
}

export async function deleteCabinet(cabinetId) {
  const id = Number(cabinetId);
  return prisma.$transaction(async (tx) => {
    const cabinet = await tx.cabinet.findUnique({
      where: { id },
      include: { lockers: true }
    });
    if (!cabinet) {
      throw new Error('Cabinet not found');
    }

    const lockerIds = cabinet.lockers.map(l => l.lockerId);

    // 1. Delete all related locker logs
    if (lockerIds.length > 0) {
      await tx.lockerLog.deleteMany({
        where: { lockerId: { in: lockerIds } }
      });
    }

    // 2. Delete all related OTP records
    await tx.otp.deleteMany({
      where: { lockerId: cabinet.identity }
    });

    // 3. Delete all locker compartments
    await tx.locker.deleteMany({
      where: { cabinetId: id }
    });

    // 4. Delete the cabinet itself
    return tx.cabinet.delete({
      where: { id }
    });
  });
}

// Simple short-lived memory cache for requestIds to prevent concurrent duplicate processing (e.g. MQTT worker + Webhook bridge)
const processedRequestCache = new Map();

function cacheRequestResult(requestId, result) {
  processedRequestCache.set(requestId, result);
  setTimeout(() => {
    processedRequestCache.delete(requestId);
  }, 10000);
}

export async function createCabinetOtp(input) {
  const { requestId } = input || {};
  
  // If this exact requestId was processed recently, return the exact same result immediately!
  if (requestId && processedRequestCache.has(requestId)) {
    return processedRequestCache.get(requestId);
  }

  const hello = await recordCabinetHello(input);
  if (hello.status !== 'APPROVED') return hello;

  const cabinetIdentity = hello.cabinet.identity;
  const now = Date.now();

  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(now + 30_000);

  // Delete all existing OTPs for this cabinet immediately to auto-invalidate the old code
  await prisma.otp.deleteMany({
    where: { lockerId: cabinetIdentity }
  });

  await prisma.otp.create({
    data: {
      code,
      lockerId: cabinetIdentity,
      userId: null,
      expiresAt,
      used: false,
    },
  });

  const responseResult = {
    status: 'APPROVED',
    cabinet: hello.cabinet,
    code,
    expiresAt,
    expiresIn: 30,
    qrPayload: code,
  };

  if (requestId) {
    cacheRequestResult(requestId, responseResult);
  }

  return responseResult;
}
