import prisma from '../../lib/prisma.js';
import { requireAuth } from '../../lib/auth.js';
import { verifyTotp } from '../../lib/otp.js';
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

  if (!lockerId || !method) {
    return res.status(400).json({ error: 'lockerId and method are required' });
  }
  if (!['qr', 'otp'].includes(method)) {
    return res.status(400).json({ error: 'method must be "qr" or "otp"' });
  }
  if (method === 'otp' && (!code || !/^\d{6}$/.test(code))) {
    return res.status(400).json({ error: 'A valid 6-digit OTP code is required' });
  }

  try {
    const locker = await prisma.locker.findUnique({
      where: { lockerId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!locker) {
      return res.status(404).json({ error: `Locker "${lockerId}" not found` });
    }
    if (locker.status === 'MAINTENANCE') {
      return res.status(409).json({ error: 'Locker is under maintenance' });
    }

    // ── OTP Verification ──────────────────────────────────────
    if (method === 'otp') {
      const valid = verifyTotp(code, locker.totpSecret);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid or expired OTP code' });
      }
    }

    // ── Determine action (toggle logic) ──────────────────────
    const isLocked = locker.status === 'IN_USE';
    const action = isLocked ? 'unlock' : 'lock';

    // If locked by another user, only admin can unlock
    if (isLocked && locker.userId !== payload.userId && payload.role !== 'ADMIN') {
      return res.status(403).json({ error: 'This locker is in use by another user' });
    }

    // ── Update DB ─────────────────────────────────────────────
    const newStatus = action === 'unlock' ? 'AVAILABLE' : 'IN_USE';
    await prisma.locker.update({
      where: { lockerId },
      data: {
        status: newStatus,
        userId: action === 'lock' ? payload.userId : null,
        lockedAt: action === 'lock' ? new Date() : null,
      },
    });

    // ── Log ───────────────────────────────────────────────────
    await prisma.lockerLog.create({
      data: {
        lockerId,
        userId: payload.userId,
        action,
        method,
        note: `${method.toUpperCase()} by ${payload.username}`,
      },
    });

    // ── Publish MQTT to ESP32 ─────────────────────────────────
    let mqttOk = true;
    try {
      await publishCommand(lockerId, {
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
      lockerId,
      newStatus,
      mqttDelivered: mqttOk,
    });
  } catch (err) {
    console.error('[unlock]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
