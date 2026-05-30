import crypto from 'crypto';
import prisma from '../../lib/prisma.js';
import { requireAdmin } from '../../lib/auth.js';
import { generateTotpSecret } from '../../lib/otp.js';
import { publishCommand } from '../../lib/mqtt.js';

/**
 * GET  /api/admin/lockers?zone=&status=&page=1&limit=50
 * POST /api/admin/lockers — create locker
 * PUT  /api/admin/lockers — bulk update status (body: { lockerIds[], status })
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const payload = requireAdmin(req, res);
  if (!payload) return;

  // ── GET ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { zone, status, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (zone) where.zone = zone.toUpperCase();
    if (status) where.status = status.toUpperCase();

    try {
      const [lockers, total] = await Promise.all([
        prisma.locker.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: [{ zone: 'asc' }, { row: 'asc' }, { col: 'asc' }],
          include: { user: { select: { id: true, name: true, username: true } } },
        }),
        prisma.locker.count({ where }),
      ]);
      // Don't expose totpSecret to frontend
      const safe = lockers.map(({ totpSecret: _, ...l }) => l);
      return res.status(200).json({ lockers: safe, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
      console.error('[admin/lockers GET]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── POST — create locker ──────────────────────────────────
  if (req.method === 'POST') {
    const { lockerId, zone, floor = 0, row, col, description } = req.body || {};
    if (!lockerId || !zone || row == null || col == null) {
      return res.status(400).json({ error: 'lockerId, zone, row, col are required' });
    }
    try {
      const totpSecret = generateTotpSecret();
      const locker = await prisma.locker.create({
        data: { lockerId: lockerId.toUpperCase(), zone: zone.toUpperCase(), floor: parseInt(floor), row: parseInt(row), col: parseInt(col), description, totpSecret },
        select: { lockerId: true, zone: true, floor: true, row: true, col: true, status: true, description: true },
      });
      await prisma.systemLog.create({
        data: { userId: payload.userId, action: 'create_locker', details: `Created locker ${lockerId}` },
      });
      return res.status(201).json({ success: true, locker });
    } catch (err) {
      if (err.code === 'P2002') return res.status(409).json({ error: 'Locker ID already exists' });
      console.error('[admin/lockers POST]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── PUT — update single locker status ────────────────────
  if (req.method === 'PUT') {
    const { lockerId, status, action } = req.body || {};
    if (!lockerId) return res.status(400).json({ error: 'lockerId is required' });

    const validStatuses = ['AVAILABLE', 'IN_USE', 'MAINTENANCE'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    try {
      const dataUpdate = {
        ...(status ? { status } : {}),
        ...((status === 'AVAILABLE' || status === 'MAINTENANCE') ? { userId: null, lockedAt: null } : {}),
      };

      const locker = await prisma.locker.update({
        where: { lockerId },
        data: dataUpdate,
      });

      // Auto-resolve physical action based on transition:
      // - Status -> AVAILABLE (Unlock / Restore): physically unlock (LOW)
      // - Status -> MAINTENANCE: physically lock (HIGH)
      let resolvedAction = action;
      if (status === 'AVAILABLE') {
        resolvedAction = 'unlock';
      } else if (status === 'MAINTENANCE') {
        resolvedAction = 'lock';
      }

      // If resolved action is lock or unlock, publish MQTT
      if (resolvedAction === 'lock' || resolvedAction === 'unlock') {
        try {
          await publishCommand(lockerId, { action: resolvedAction, method: 'admin', userId: payload.userId });
        } catch {/* non-critical */}

        await prisma.lockerLog.create({
          data: { lockerId, userId: payload.userId, action: resolvedAction, method: 'admin' },
        });
      }

      await prisma.systemLog.create({
        data: { userId: payload.userId, action: 'update_locker', details: `${lockerId}: ${JSON.stringify({ status, action: resolvedAction })}` },
      });

      return res.status(200).json({ success: true, lockerId, status: locker.status });
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: 'Locker not found' });
      console.error('[admin/lockers PUT]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
