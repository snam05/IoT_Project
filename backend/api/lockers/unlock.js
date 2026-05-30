import prisma from '../../lib/prisma.js';
import { requireAuth } from '../../lib/auth.js';
import { publishCommand } from '../../lib/mqtt.js';

/**
 * POST /api/lockers/unlock
 *
 * Body:
 *   { lockerId: string, method: "qr" | "otp", code?: string }
 *
 * For QR: client sends lockerId extracted from scanned QR payload.
 *   Server verifies user is logged in (JWT cookie) + locker exists + status allows unlock.
 *
 * For OTP: client sends lockerId + 6-digit code displayed on ESP32 screen.
 *   Server verifies TOTP using locker's totpSecret.
 *
 * On success: publishes MQTT command, logs to DB, updates locker status.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const payload = requireAuth(req, res);
  if (!payload) return;

  const { lockerId, method, code } = req.body || {};

  if (!method) {
    return res.status(400).json({ error: 'method is required' });
  }
  if (!['qr', 'otp'].includes(method)) {
    return res.status(400).json({ error: 'method must be "qr" or "otp"' });
  }
  if (method === 'qr' && !lockerId) {
    return res.status(400).json({ error: 'lockerId is required for QR' });
  }
  if (method === 'otp' && (!code || !/^\d{6}$/.test(code))) {
    return res.status(400).json({ error: 'A valid 6-digit OTP code is required' });
  }

  try {
    let selectedLocker = null;
    let cabinet = null;
    let cabinetCode = null;
    let codeFromQr = null;
    let compartmentNo = null;

    // Resolve lockerId parsing if it was sent
    if (lockerId) {
      if (lockerId.includes(':')) {
        const parts = lockerId.split(':');
        cabinetCode = parts[0].trim().toUpperCase();
        const secondPart = parts[1].trim();
        if (secondPart.length === 6 && /^\d{6}$/.test(secondPart)) {
          codeFromQr = secondPart;
        } else if (/^\d+$/.test(secondPart)) {
          compartmentNo = parseInt(secondPart);
        }
      } else {
        const cab = await prisma.cabinet.findUnique({
          where: { cabinetCode: lockerId.toUpperCase() }
        });
        if (cab) {
          cabinetCode = cab.cabinetCode;
        }
      }
    }

    const resolvedCode = code || codeFromQr;

    // If OTP method and lockerId was not provided, look up the OTP code directly to resolve cabinetCode
    if (method === 'otp' && !lockerId && resolvedCode) {
      const otp = await prisma.otp.findFirst({
        where: {
          code: resolvedCode,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!otp) return res.status(401).json({ error: 'Invalid or expired OTP code' });

      const cabIdentity = otp.lockerId; // e.g. "TEST_CABINET:8"
      const [parsedCabCode] = cabIdentity.split(':');
      cabinetCode = parsedCabCode.toUpperCase();
    }

    if (cabinetCode) {
      cabinet = await prisma.cabinet.findUnique({
        where: { cabinetCode },
        include: { lockers: true }
      });
    }

    // First, check if the current user already has an active (IN_USE) locker in the entire system
    const activeLocker = await prisma.locker.findFirst({
      where: {
        userId: payload.userId,
        status: 'IN_USE'
      },
      include: { cabinet: true }
    });

    if (activeLocker) {
      selectedLocker = activeLocker;
    } else {
      if (cabinet) {
        // If we had lockerId provided, verify the OTP now.
        if (lockerId && resolvedCode) {
          const otp = await prisma.otp.findFirst({
            where: {
              lockerId: cabinet.identity,
              code: resolvedCode,
              expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
          });
          if (!otp) return res.status(401).json({ error: 'Invalid or expired OTP code' });
        }

        if (compartmentNo != null) {
          selectedLocker = cabinet.lockers.find(l => l.compartmentNo === compartmentNo);
          if (!selectedLocker) {
            return res.status(404).json({ error: `Compartment ${compartmentNo} not found in cabinet ${cabinetCode}` });
          }
        } else {
          const availableLockers = cabinet.lockers.filter(l => l.status === 'AVAILABLE');
          if (availableLockers.length === 0) {
            return res.status(409).json({ error: 'Cabinet is full. No available lockers.' });
          }

          const randomIndex = Math.floor(Math.random() * availableLockers.length);
          selectedLocker = availableLockers[randomIndex];
        }
      } else {
        selectedLocker = await prisma.locker.findUnique({
          where: { lockerId: lockerId.toUpperCase() },
          include: { cabinet: true }
        });
      }
    }

    if (!selectedLocker) {
      return res.status(404).json({ error: `Locker "${lockerId}" not found` });
    }

    if (selectedLocker.status === 'MAINTENANCE') {
      return res.status(409).json({ error: 'Locker is under maintenance' });
    }

    const isLocked = selectedLocker.status === 'IN_USE';
    const action = isLocked ? 'unlock' : 'lock';

    if (isLocked && selectedLocker.userId !== payload.userId && payload.role !== 'ADMIN') {
      return res.status(403).json({ error: 'This locker is in use by another user' });
    }

    const newStatus = action === 'unlock' ? 'AVAILABLE' : 'IN_USE';
    await prisma.locker.update({
      where: { id: selectedLocker.id },
      data: {
        status: newStatus,
        userId: action === 'lock' ? payload.userId : null,
        lockedAt: action === 'lock' ? new Date() : null,
      }
    });

    // ── Log ───────────────────────────────────────────────────
    await prisma.lockerLog.create({
      data: {
        lockerId: selectedLocker.lockerId,
        userId: payload.userId,
        action,
        method,
        note: `${method.toUpperCase()} by ${payload.username}`,
      },
    });

    // ── Publish MQTT to ESP32 ─────────────────────────────────
    let mqttOk = true;
    try {
      await publishCommand(selectedLocker.lockerId, {
        action,
        method,
        userId: payload.userId,
        username: payload.username,
      });
    } catch (mqttErr) {
      mqttOk = false;
      console.warn('[unlock] MQTT publish failed:', mqttErr.message);
    }

    return res.status(200).json({
      success: true,
      action,
      lockerId: selectedLocker.lockerId,
      newStatus,
      mqttDelivered: mqttOk,
    });
  } catch (err) {
    console.error('[unlock]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
