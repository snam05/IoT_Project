import jwt from 'jsonwebtoken';
import { parse } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const COOKIE_NAME = 'lockersys_token';

// ─── Token Generation ──────────────────────────────────────────
export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// ─── Token Verification ────────────────────────────────────────
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ─── Extract token from request (cookie or Authorization header) ─
export function extractToken(req) {
  // 1. Try httpOnly cookie
  const cookieHeader = req.headers?.cookie || req.headers?.Cookie || '';
  if (cookieHeader) {
    const cookies = parse(cookieHeader);
    if (cookies[COOKIE_NAME]) return cookies[COOKIE_NAME];
  }
  // 2. Try Authorization: Bearer <token>
  const authHeader = req.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

// ─── Middleware Helpers ────────────────────────────────────────

/** Returns { userId, role } or sends 401 */
export function requireAuth(req, res) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized — no token' });
    return null;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized — invalid or expired token' });
    return null;
  }
  return payload; // { userId, username, role, iat, exp }
}

/** Returns { userId, role } or sends 403 */
export function requireAdmin(req, res) {
  const payload = requireAuth(req, res);
  if (!payload) return null;
  if (payload.role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden — admin access required' });
    return null;
  }
  return payload;
}

// ─── Cookie Builder ────────────────────────────────────────────
export function buildAuthCookie(token) {
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
  return [
    `${COOKIE_NAME}=${token}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    isProduction ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export function buildClearCookie() {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`;
}

export { COOKIE_NAME };
