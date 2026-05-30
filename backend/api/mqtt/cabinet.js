import { createCabinetOtp, recordCabinetHello } from '../../lib/cabinet.js';
import { publishCabinetOtp, publishCabinetRegistration } from '../../lib/mqtt.js';

function checkBridgeAuth(req) {
  const expected = process.env.MQTT_BRIDGE_TOKEN;
  if (!expected) return true;
  const header = req.headers?.authorization || '';
  return header === `Bearer ${expected}`;
}

async function handleHello(body) {
  const result = await recordCabinetHello(body);
  const cabinetCode = result.cabinet?.cabinetCode || String(body.cabinetCode || '').trim().toUpperCase();
  if (cabinetCode) {
    let statesStr = "";
    if (result.lockers) {
      const sorted = [...result.lockers].sort((a, b) => a.compartmentNo - b.compartmentNo);
      statesStr = sorted.map(l => (l.status === 'AVAILABLE' ? '0' : '1')).join('');
    }
    await publishCabinetRegistration(cabinetCode, {
      status: result.status,
      message: result.message,
      cabinetCode,
      identity: result.cabinet?.identity || result.receivedIdentity,
      expectedIdentity: result.expectedIdentity,
      receivedIdentity: result.receivedIdentity,
      compartmentCount: result.cabinet?.compartmentCount || Number(body.compartmentCount),
      states: statesStr,
    });
  }
  return result;
}

async function handleOtpRequest(body) {
  const result = await createCabinetOtp(body);
  const cabinetCode = result.cabinet?.cabinetCode || String(body.cabinetCode || '').trim().toUpperCase();
  if (cabinetCode) {
    await publishCabinetOtp(cabinetCode, {
      status: result.status,
      message: result.message,
      cabinetCode,
      identity: result.cabinet?.identity || result.receivedIdentity,
      code: result.code,
      qrPayload: result.qrPayload,
      expiresIn: result.expiresIn,
      expiresAt: result.expiresAt,
    });
  }
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkBridgeAuth(req)) return res.status(401).json({ error: 'Unauthorized bridge token' });

  const { type, ...body } = req.body || {};
  if (!['hello', 'otp_request'].includes(type)) {
    return res.status(400).json({ error: 'type must be hello or otp_request' });
  }

  try {
    const result = type === 'hello' ? await handleHello(body) : await handleOtpRequest(body);
    return res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('[mqtt/cabinet]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
