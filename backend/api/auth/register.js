import bcrypt from 'bcryptjs';
import prisma from '../../lib/prisma.js';
import { signToken, buildAuthCookie } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, email, name, password } = req.body || {};

  if (!username || !email || !name || !password) {
    return res.status(400).json({ error: 'All fields (username, email, name, password) are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase().trim() },
          { email: email.toLowerCase().trim() },
        ],
      },
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
        role: 'USER',
      },
    });

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // Audit log
    prisma.systemLog
      .create({
        data: {
          userId: user.id,
          action: 'register',
          details: `Registered account: ${user.username}`,
          ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        },
      })
      .catch((logErr) => console.error('[register:log]', logErr));

    res.setHeader('Set-Cookie', buildAuthCookie(token));
    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('[register]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
