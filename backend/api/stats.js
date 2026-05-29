import prisma from '../lib/prisma.js';
import { requireAuth } from '../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const payload = requireAuth(req, res);
  if (!payload) return;

  try {
    const [total, inUse, maintenance, available, totalUsers, recentUnlocks] = await Promise.all([
      prisma.locker.count(),
      prisma.locker.count({ where: { status: 'IN_USE' } }),
      prisma.locker.count({ where: { status: 'MAINTENANCE' } }),
      prisma.locker.count({ where: { status: 'AVAILABLE' } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.lockerLog.count({
        where: {
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          action: 'unlock',
        },
      }),
    ]);

    const capacityPct = total > 0 ? Math.round((inUse / total) * 100) : 0;

    return res.status(200).json({
      total,
      inUse,
      maintenance,
      available,
      totalUsers,
      recentUnlocks,
      capacity: `${capacityPct}% capacity`,
      growth: '+0 this month', // TODO: compute from DB with date range
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[stats]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
