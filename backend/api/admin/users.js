import bcrypt from 'bcryptjs';
import prisma from '../../lib/prisma.js';
import { requireAdmin } from '../../lib/auth.js';
import { getClientIp } from '../../lib/ip.js';

/**
 * GET  /api/admin/users?page=1&limit=20&search=
 * POST /api/admin/users — create user
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const payload = requireAdmin(req, res);
  if (!payload) return;

  // ── GET — List users ──────────────────────────────────────
  if (req.method === 'GET') {
    const { page = '1', limit = '20', search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = search
      ? {
          OR: [
            { username: { contains: search } },
            { name: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {};

    try {
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            username: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
            _count: { select: { lockerLogs: true } },
          },
        }),
        prisma.user.count({ where }),
      ]);

      return res.status(200).json({
        users,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      });
    } catch (err) {
      console.error('[admin/users GET]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── POST — Create user ────────────────────────────────────
  if (req.method === 'POST') {
    const { username, email, name, password, role = 'USER' } = req.body || {};

    if (!username || !email || !name || !password) {
      return res.status(400).json({ error: 'username, email, name, and password are required' });
    }
    if (!['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'role must be USER or ADMIN' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    try {
      const existing = await prisma.user.findFirst({
        where: { OR: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] },
      });
      if (existing) {
        return res.status(409).json({ error: 'Username or email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: {
          username: username.toLowerCase().trim(),
          email: email.toLowerCase().trim(),
          name: name.trim(),
          passwordHash,
          role,
        },
        select: { id: true, username: true, email: true, name: true, role: true, createdAt: true },
      });

      const ip = getClientIp(req);
      await prisma.systemLog.create({
        data: {
          userId: payload.userId,
          action: 'create_user',
          details: `Created user: ${user.username} (${role})`,
          ipAddress: ip,
        },
      });

      return res.status(201).json({ success: true, user });
    } catch (err) {
      console.error('[admin/users POST]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
