import prisma from '../../../lib/prisma.js';
import { requireAdmin } from '../../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const payload = requireAdmin(req, res);
  if (!payload) return;

  if (req.method === 'GET') {
    const { page = '1', limit = '20', action, userId, startDate, endDate, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (action) where.action = action;
    if (userId) where.userId = parseInt(userId);

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.timestamp.lte = end;
      }
    }

    if (search) {
      where.OR = [
        { action: { contains: search } },
        { details: { contains: search } },
        { ipAddress: { contains: search } },
        { user: { name: { contains: search } } },
        { user: { username: { contains: search } } }
      ];
    }

    try {
      const [logs, total] = await Promise.all([
        prisma.systemLog.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { timestamp: 'desc' },
          include: { user: { select: { id: true, username: true, name: true } } },
        }),
        prisma.systemLog.count({ where }),
      ]);
      return res.status(200).json({ logs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
      console.error('[admin/logs/system GET]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    const { beforeDate } = req.query;
    const where = {};
    if (beforeDate) {
      where.timestamp = { lte: new Date(beforeDate) };
    }

    try {
      const result = await prisma.systemLog.deleteMany({ where });
      return res.status(200).json({ success: true, count: result.count });
    } catch (err) {
      console.error('[admin/logs/system DELETE]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
