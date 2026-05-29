/**
 * GET  /api/profile        — fetch current user info
 * PUT  /api/profile        — update profile
 * POST /api/profile/logout — sign out
 *
 * When deploying: validate JWT token from Authorization header,
 * then query the user database.
 */
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // TODO: Validate JWT from req.headers.authorization
  // const token = req.headers.authorization?.replace('Bearer ', '');

  if (req.method === 'GET') {
    // Mock user — replace with DB query
    const user = {
      id: 'u-001',
      name: 'John Smith',
      email: 'john.smith@example.com',
      avatarUrl: null,
      memberSince: '2024',
      twoFa: false,
      role: 'user', // 'user' | 'admin'
      assignedLockers: ['A-003', 'A-007'],
    };
    return res.status(200).json(user);
  }

  if (req.method === 'PUT') {
    const { name, email } = req.body || {};
    // TODO: validate & save to DB
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      updated: { name, email },
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
