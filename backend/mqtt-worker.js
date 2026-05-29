import 'dotenv/config';
import mqtt from 'mqtt';
import { fileURLToPath } from 'node:url';
import { createCabinetOtp, recordCabinetHello } from './lib/cabinet.js';
import { TOPICS } from './lib/mqtt.js';

function parseJson(payload) {
  try {
    return JSON.parse(payload.toString());
  } catch {
    return null;
  }
}

function buildMqttClient() {
  const url = `mqtts://${process.env.MQTT_HOST}:${process.env.MQTT_PORT || '8883'}`;
  return mqtt.connect(url, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    rejectUnauthorized: true,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
  });
}

export function startMqttWorker() {
  if (!process.env.MQTT_HOST) {
    console.warn('[mqtt-worker] MQTT_HOST is not set; worker disabled');
    return null;
  }

  const client = buildMqttClient();

  function publish(topic, payload) {
    client.publish(topic, JSON.stringify({ ...payload, ts: Date.now() }), { qos: 1, retain: false });
  }

  async function handleHello(message) {
    const result = await recordCabinetHello(message);
    const cabinetCode = result.cabinet?.cabinetCode || String(message.cabinetCode || '').trim().toUpperCase();
    if (!cabinetCode) return;
    publish(TOPICS.cabinetRegistration(cabinetCode), {
      status: result.status,
      message: result.message,
      cabinetCode,
      identity: result.cabinet?.identity || result.receivedIdentity,
      expectedIdentity: result.expectedIdentity,
      receivedIdentity: result.receivedIdentity,
      compartmentCount: result.cabinet?.compartmentCount || Number(message.compartmentCount),
    });
  }

  async function handleOtpRequest(message) {
    const result = await createCabinetOtp(message);
    const cabinetCode = result.cabinet?.cabinetCode || String(message.cabinetCode || '').trim().toUpperCase();
    if (!cabinetCode) return;
    publish(TOPICS.cabinetOtpResponse(cabinetCode), {
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

  client.on('connect', () => {
    console.log('[mqtt-worker] connected');
    client.subscribe([TOPICS.cabinetHello(), TOPICS.cabinetOtpRequest()], { qos: 1 }, (err) => {
      if (err) console.error('[mqtt-worker] subscribe failed', err);
      else console.log('[mqtt-worker] subscribed to cabinet hello and OTP requests');
    });
  });

  client.on('message', async (topic, payload) => {
    const message = parseJson(payload);
    if (!message) return console.warn('[mqtt-worker] invalid JSON', topic);

    try {
      if (topic.endsWith('/hello')) await handleHello(message);
      if (topic.endsWith('/otp/request')) await handleOtpRequest(message);
    } catch (err) {
      console.error('[mqtt-worker] handler failed', topic, err);
    }
  });

  client.on('error', (err) => console.error('[mqtt-worker] mqtt error', err.message));
  return client;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startMqttWorker();
}
