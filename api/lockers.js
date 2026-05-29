import prisma from '../../lib/prisma.js';
import { requireAuth } from '../../lib/auth.js';

/**
 * GET /api/lockers?zone=A&status=AVAILABLE&page=1&limit=50
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const payload = requireAuth(req, res);
  if (!payload) return;

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
        select: {
          lockerId: true,
          zone: true,
          floor: true,
          row: true,
          col: true,
          status: true,
          lockedAt: true,
          description: true,
          user: { select: { id: true, name: true, username: true } },
        },
      }),
      prisma.locker.count({ where }),
    ]);

    // Stats summary
    const stats = await prisma.locker.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    const summary = Object.fromEntries(stats.map((s) => [s.status, s._count.status]));

    return res.status(200).json({
      lockers,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      summary: {
        AVAILABLE: summary.AVAILABLE || 0,
        IN_USE: summary.IN_USE || 0,
        MAINTENANCE: summary.MAINTENANCE || 0,
      },
    });
  } catch (err) {
    console.error('[lockers]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
