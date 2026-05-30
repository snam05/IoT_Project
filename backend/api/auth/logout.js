import prisma from '../../lib/prisma.js';
import { extractToken, verifyToken, buildClearCookie } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      try {
        await prisma.systemLog.create({
          data: {
            userId: payload.userId,
            action: 'logout',
            ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
          },
        });
      } catch {/* non-critical */}
    }
  }

  res.setHeader('Set-Cookie', buildClearCookie());
  return res.status(200).json({ message: 'Logged out successfully' });
}
