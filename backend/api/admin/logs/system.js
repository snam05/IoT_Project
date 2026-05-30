import prisma from '../../../lib/prisma.js';
import { requireAdmin } from '../../../lib/auth.js';

/**
 * GET /api/admin/logs/system?page=1&limit=20&action=&userId=
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const payload = requireAdmin(req, res);
  if (!payload) return;

  const { page = '1', limit = '20', action, userId } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {};
  if (action) where.action = action;
  if (userId) where.userId = parseInt(userId);

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
    console.error('[admin/logs/system]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
