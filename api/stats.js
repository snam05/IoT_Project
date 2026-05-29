/**
 * GET /api/stats
 * Returns overall system statistics for the locker system.
 * When deploying the real API, connect to the database here.
 */
export default function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Mock data — replace with real DB query
  const stats = {
    total: 245,
    inUse: 182,
    available: 60,
    maintenance: 3,
    capacity: '74% capacity',
    growth: '+12 this month',
    updatedAt: new Date().toISOString(),
  };

  return res.status(200).json(stats);
}
