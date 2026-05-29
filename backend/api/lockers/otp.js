import prisma from '../../lib/prisma.js';
import { requireAuth } from '../../lib/auth.js';
import { getCurrentTotp, secondsUntilNextTotp } from '../../lib/otp.js';

/**
 * GET /api/lockers/otp?lockerId=A-001
 *
 * Returns the current 6-digit TOTP for a locker.
 * This endpoint is for DISPLAY purposes (e.g., admin panel).
 * In real deployment, the ESP32 displays this code on its screen.
 *
 * Note: In production, this endpoint should be admin-only
 * or limited to the locker's assigned user.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const payload = requireAuth(req, res);
  if (!payload) return;

  const { lockerId } = req.query;
  if (!lockerId) return res.status(400).json({ error: 'lockerId is required' });

  try {
    const locker = await prisma.locker.findUnique({
      where: { lockerId },
      select: { lockerId: true, totpSecret: true, status: true },
    });

    if (!locker) return res.status(404).json({ error: 'Locker not found' });

    const code = getCurrentTotp(locker.totpSecret);
    const expiresIn = Math.ceil(secondsUntilNextTotp());

    return res.status(200).json({
      lockerId: locker.lockerId,
      code,
      expiresIn,
      status: locker.status,
    });
  } catch (err) {
    console.error('[otp]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
