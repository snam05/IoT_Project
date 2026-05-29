/**
 * GET /api/lockers
 * Returns the list of lockers and their current status.
 * Supports query params: ?zone=A&status=available
 * When deploying the real API, connect to the database and MQTT broker here.
 */
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { zone, status } = req.query;

  // Mock locker data
  const allLockers = [
    // Zone A - Ground Floor
    { id: 'A-001', zone: 'A', floor: 0, row: 1, col: 1, status: 'in_use', userId: 'u-123', lockedAt: '2024-01-15T08:30:00Z' },
    { id: 'A-002', zone: 'A', floor: 0, row: 1, col: 2, status: 'in_use', userId: 'u-456', lockedAt: '2024-01-15T09:00:00Z' },
    { id: 'A-003', zone: 'A', floor: 0, row: 1, col: 3, status: 'available', userId: null, lockedAt: null },
    { id: 'A-004', zone: 'A', floor: 0, row: 1, col: 4, status: 'in_use', userId: 'u-789', lockedAt: '2024-01-15T07:45:00Z' },
    { id: 'A-005', zone: 'A', floor: 0, row: 1, col: 5, status: 'in_use', userId: 'u-321', lockedAt: '2024-01-15T10:15:00Z' },
    { id: 'A-006', zone: 'A', floor: 0, row: 1, col: 6, status: 'maintenance', userId: null, lockedAt: null },
    { id: 'A-007', zone: 'A', floor: 0, row: 2, col: 1, status: 'available', userId: null, lockedAt: null },
    { id: 'A-008', zone: 'A', floor: 0, row: 2, col: 2, status: 'available', userId: null, lockedAt: null },
    { id: 'A-009', zone: 'A', floor: 0, row: 2, col: 3, status: 'in_use', userId: 'u-654', lockedAt: '2024-01-15T11:00:00Z' },
    { id: 'A-010', zone: 'A', floor: 0, row: 2, col: 4, status: 'in_use', userId: 'u-987', lockedAt: '2024-01-15T08:00:00Z' },
    { id: 'A-011', zone: 'A', floor: 0, row: 2, col: 5, status: 'in_use', userId: 'u-111', lockedAt: '2024-01-15T09:30:00Z' },
    { id: 'A-012', zone: 'A', floor: 0, row: 2, col: 6, status: 'in_use', userId: 'u-222', lockedAt: '2024-01-15T10:45:00Z' },
    { id: 'A-013', zone: 'A', floor: 0, row: 3, col: 1, status: 'in_use', userId: 'u-333', lockedAt: '2024-01-15T07:30:00Z' },
    { id: 'A-014', zone: 'A', floor: 0, row: 3, col: 2, status: 'available', userId: null, lockedAt: null },
    { id: 'A-015', zone: 'A', floor: 0, row: 3, col: 3, status: 'available', userId: null, lockedAt: null },
    { id: 'A-016', zone: 'A', floor: 0, row: 3, col: 4, status: 'maintenance', userId: null, lockedAt: null },
    { id: 'A-017', zone: 'A', floor: 0, row: 3, col: 5, status: 'in_use', userId: 'u-444', lockedAt: '2024-01-15T11:30:00Z' },
    { id: 'A-018', zone: 'A', floor: 0, row: 3, col: 6, status: 'in_use', userId: 'u-555', lockedAt: '2024-01-15T08:15:00Z' },
  ];

  if (req.method === 'GET') {
    let filtered = allLockers;
    if (zone) filtered = filtered.filter((l) => l.zone === zone.toUpperCase());
    if (status) filtered = filtered.filter((l) => l.status === status);
    return res.status(200).json({ lockers: filtered, total: filtered.length });
  }

  if (req.method === 'PUT') {
    // TODO: implement lock/unlock action
    // req.body = { lockerId, action: 'lock' | 'unlock' }
    return res.status(200).json({ success: true, message: 'Action queued' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
