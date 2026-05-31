/**
 * Extract client real IP address under Cloudflare -> Traefik -> reverse proxy setups.
 * @param {import('http').IncomingMessage} req 
 * @returns {string} Real client IP address
 */
export function getClientIp(req) {
  if (!req || !req.headers) return 'unknown';

  // 1. Cloudflare connecting IP header
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return cfIp.trim();

  // 2. Traefik / Nginx Real IP header
  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) return xRealIp.trim();

  // 3. Standard x-forwarded-for header (first IP in the proxy chain is the real client)
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(',')[0];
    if (firstIp) return firstIp.trim();
  }

  // 4. Fallback to physical TCP socket remote address
  return req.socket?.remoteAddress || 'unknown';
}
