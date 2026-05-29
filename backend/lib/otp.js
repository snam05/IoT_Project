import crypto from 'crypto';

const TOTP_STEP = 30; // seconds per window

// ─── HOTP (HMAC-based OTP) — RFC 4226 ─────────────────────────
function hotp(secretBase64, counter) {
  const key = Buffer.from(secretBase64, 'base64');
  const msg = Buffer.alloc(8);
  // Write counter as big-endian 64-bit integer
  const big = BigInt(counter);
  msg.writeBigUInt64BE(big);
  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  // Dynamic truncation
  const offset = hmac[19] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1_000_000;
  return String(code).padStart(6, '0');
}

// ─── TOTP — RFC 6238 ──────────────────────────────────────────

/** Get current TOTP counter (unix_time / step) */
function getCounter(offsetSteps = 0) {
  return Math.floor(Date.now() / 1000 / TOTP_STEP) + offsetSteps;
}

/**
 * Get current 6-digit TOTP for a locker.
 * @param {string} totpSecret — base64 string stored in Locker.totpSecret
 */
export function getCurrentTotp(totpSecret) {
  return hotp(totpSecret, getCounter(0));
}

/**
 * Verify a 6-digit code against a locker's TOTP secret.
 * Allows ±1 window (±30s) to account for clock drift.
 * @returns {boolean}
 */
export function verifyTotp(code, totpSecret) {
  for (const offset of [-1, 0, 1]) {
    if (hotp(totpSecret, getCounter(offset)) === code) return true;
  }
  return false;
}

/**
 * Generate a new random TOTP secret (20 bytes → base64).
 * Store this in Locker.totpSecret AND program into the ESP32.
 */
export function generateTotpSecret() {
  return crypto.randomBytes(20).toString('base64');
}

/**
 * How many seconds until the current TOTP window expires.
 */
export function secondsUntilNextTotp() {
  const now = Date.now() / 1000;
  return TOTP_STEP - (now % TOTP_STEP);
}
