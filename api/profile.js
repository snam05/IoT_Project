import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const payload = requireAuth(req, res);
  if (!payload) return;

  // ── GET /api/profile ──────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
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
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json(user);
    } catch (err) {
      console.error('[profile GET]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── PUT /api/profile ─────────────────────────────────────
  // Only allow updating: name, password
  // username and email are LOCKED
  if (req.method === 'PUT') {
    const { name, currentPassword, newPassword } = req.body || {};

    if (!name && !newPassword) {
      return res.status(400).json({ error: 'Provide name or password to update' });
    }

    const updateData = {};

    // Validate and update name
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'Name cannot be empty' });
      updateData.name = name.trim();
    }

    // Validate and update password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to set a new password' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }

      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    try {
      const updated = await prisma.user.update({
        where: { id: payload.userId },
        data: updateData,
        select: { id: true, username: true, email: true, name: true, role: true },
      });

      await prisma.systemLog.create({
        data: {
          userId: payload.userId,
          action: 'update_profile',
          details: JSON.stringify({ fields: Object.keys(updateData) }),
        },
      });

      return res.status(200).json({ success: true, user: updated });
    } catch (err) {
      console.error('[profile PUT]', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
