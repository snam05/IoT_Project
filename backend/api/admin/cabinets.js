import prisma from '../../lib/prisma.js';
import { requireAdmin } from '../../lib/auth.js';
import { approveCabinet, rejectCabinet, deleteCabinet } from '../../lib/cabinet.js';
import { publishCabinetRegistration } from '../../lib/mqtt.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const payload = requireAdmin(req, res);
  if (!payload) return;

  if (req.method === 'GET') {
    const { status, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = status ? { status: status.toUpperCase() } : {};

    try {
      const [cabinets, total] = await Promise.all([
        prisma.cabinet.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: [{ status: 'asc' }, { lastSeenAt: 'desc' }],
          include: { _count: { select: { lockers: true } } },
        }),
        prisma.cabinet.count({ where }),
      ]);
      return res.status(200).json({ cabinets, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
      console.error('[admin/cabinets GET]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    const { id, action } = req.body || {};
    if (!id || !['approve', 'reject', 'lock_all', 'unlock_all'].includes(action)) {
      return res.status(400).json({ error: 'id and action (approve/reject/lock_all/unlock_all) are required' });
    }

    try {
      if (action === 'approve' || action === 'reject') {
        const cabinet = action === 'approve' ? await approveCabinet(id) : await rejectCabinet(id);
        if (!cabinet) return res.status(404).json({ error: 'Cabinet not found' });

        await prisma.systemLog.create({
          data: { userId: payload.userId, action: `${action}_cabinet`, details: `${cabinet.identity}` },
        });

        publishCabinetRegistration(cabinet.cabinetCode, {
          status: cabinet.status,
          cabinetCode: cabinet.cabinetCode,
          identity: cabinet.identity,
          compartmentCount: cabinet.compartmentCount,
        }).catch((err) => console.warn('[admin/cabinets mqtt]', err.message));

        return res.status(200).json({ success: true, cabinet });
      }

      if (action === 'lock_all' || action === 'unlock_all') {
        const cabinet = await prisma.cabinet.findUnique({
          where: { id: parseInt(id) },
          include: { lockers: true },
        });
        if (!cabinet) return res.status(404).json({ error: 'Cabinet not found' });

        const commandAction = action === 'lock_all' ? 'lock' : 'unlock';
        const { publishCommand } = await import('../../lib/mqtt.js');

        for (const locker of cabinet.lockers) {
          try {
            await publishCommand(locker.lockerId, { action: commandAction, method: 'admin', userId: payload.userId });
          } catch (err) {
            console.warn(`[admin/cabinets ${action}] failed for ${locker.lockerId}:`, err.message);
          }

          // Update database according to the action sent to ESP32
          await prisma.locker.update({
            where: { id: locker.id },
            data: {
              status: commandAction === 'lock' ? 'IN_USE' : 'AVAILABLE',
              userId: commandAction === 'lock' ? payload.userId : null,
              lockedAt: commandAction === 'lock' ? new Date() : null,
            },
          });

          await prisma.lockerLog.create({
            data: { lockerId: locker.lockerId, userId: payload.userId, action: commandAction, method: 'admin' },
          });
        }

        await prisma.systemLog.create({
          data: { userId: payload.userId, action: `${action}_cabinet`, details: `Cabinet ID: ${id} (${cabinet.identity})` },
        });

        return res.status(200).json({ success: true, message: `Cabinet compartments physically sent command to ${commandAction}` });
      }
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: 'Cabinet not found' });
      console.error('[admin/cabinets PUT]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
      const cabinet = await deleteCabinet(id);
      await prisma.systemLog.create({
        data: { userId: payload.userId, action: 'delete_cabinet', details: `${cabinet.identity}` },
      });
      return res.status(200).json({ success: true, cabinet });
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: 'Cabinet not found' });
      console.error('[admin/cabinets DELETE]', err);
      return res.status(409).json({ error: 'Could not delete cabinet. Remove related locker logs first if this cabinet has already been used.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
