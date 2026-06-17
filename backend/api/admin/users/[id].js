import bcrypt from 'bcryptjs';
import prisma from '../../../lib/prisma.js';
import { requireAdmin } from '../../../lib/auth.js';
import { getClientIp } from '../../../lib/ip.js';

/**
 * GET    /api/admin/users/[id]  — user detail
 * PUT    /api/admin/users/[id]  — toggle isActive, change role, or reset password
 * DELETE /api/admin/users/[id]  — delete user
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const payload = requireAdmin(req, res);
  if (!payload) return;

  const id = parseInt(req.query.id || req.params?.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id' });

  // ── GET ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true, username: true, email: true, name: true,
          role: true, isActive: true, createdAt: true, updatedAt: true,
          _count: { select: { lockerLogs: true, systemLogs: true } },
        },
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json(user);
    } catch {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── PUT — toggle active / change role / reset password ────
  if (req.method === 'PUT') {
    if (id === payload.userId) {
      return res.status(400).json({ error: 'Cannot modify your own account via admin panel' });
    }
    const { isActive, role, password } = req.body || {};
    const data = {};
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (role && ['USER', 'ADMIN'].includes(role)) data.role = role;
    if (password !== undefined) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      data.passwordHash = await bcrypt.hash(password, 12);
    }

    try {
      const user = await prisma.user.update({
        where: { id },
        data,
        select: { id: true, username: true, role: true, isActive: true },
      });
      
      const logDetails = password !== undefined
        ? `Reset password and updated user #${id}: ${JSON.stringify({ ...data, passwordHash: '[REDACTED]' })}`
        : `Updated user #${id}: ${JSON.stringify(data)}`;

      const ip = getClientIp(req);
      await prisma.systemLog.create({
        data: {
          userId: payload.userId,
          action: 'update_user',
          details: logDetails,
          ipAddress: ip,
        },
      });
      return res.status(200).json({ success: true, user });
    } catch (err) {
      console.error('[PUT /api/admin/users/:id]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── DELETE ────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (id === payload.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    try {
      await prisma.user.delete({ where: { id } });
      const ip = getClientIp(req);
      await prisma.systemLog.create({
        data: {
          userId: payload.userId,
          action: 'delete_user',
          details: `Deleted user #${id}`,
          ipAddress: ip,
        },
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('[DELETE /api/admin/users/:id]', err);
      if (err.code === 'P2025') return res.status(404).json({ error: 'User not found' });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
