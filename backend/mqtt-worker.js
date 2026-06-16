import 'dotenv/config';
import mqtt from 'mqtt';
import { fileURLToPath } from 'node:url';
import { getMqttConfig } from './lib/mqtt-config.js';
import { createCabinetOtp, recordCabinetHello } from './lib/cabinet.js';
import { TOPICS } from './lib/mqtt.js';
import prisma from './lib/prisma.js';

function parseJson(payload) {
  try {
    return JSON.parse(payload.toString());
  } catch {
    return null;
  }
}

function buildMqttClient() {
  const config = getMqttConfig(10000, 3000);
  console.log('[mqtt-worker] connecting to ' + config.displayUrl);
  return mqtt.connect(config.url, config.options);
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

    let statesStr = "";
    if (result.lockers) {
      const sorted = [...result.lockers].sort((a, b) => a.compartmentNo - b.compartmentNo);
      statesStr = sorted.map(l => (l.status === 'AVAILABLE' ? '0' : '1')).join('');
    }

    publish(TOPICS.cabinetRegistration(cabinetCode), {
      status: result.status,
      message: result.message,
      cabinetCode,
      identity: result.cabinet?.identity || result.receivedIdentity,
      expectedIdentity: result.expectedIdentity,
      receivedIdentity: result.receivedIdentity,
      compartmentCount: result.cabinet?.compartmentCount || Number(message.compartmentCount),
      states: statesStr,
      secretKey: result.cabinet?.totpSecret || null,
    });
  }

  client.on('connect', () => {
    console.log('[mqtt-worker] connected');
    client.subscribe([TOPICS.cabinetHello()], { qos: 1 }, (err) => {
      if (err) console.error('[mqtt-worker] subscribe failed', err);
      else console.log('[mqtt-worker] subscribed to cabinet hello');
    });
  });

  client.on('message', async (topic, payload) => {
    const message = parseJson(payload);
    if (!message) return console.warn('[mqtt-worker] invalid JSON', topic);

    try {
      if (topic.endsWith('/hello')) await handleHello(message);
    } catch (err) {
      console.error('[mqtt-worker] handler failed', topic, err);
    }
  });

  client.on('error', (err) => console.error('[mqtt-worker] mqtt error', err.message));
  client.on('close', () => console.warn('[mqtt-worker] connection closed'));
  client.on('offline', () => console.warn('[mqtt-worker] offline'));

  // Periodic ping task to approved cabinets to keep lastSeenAt fresh
  setInterval(async () => {
    try {
      const cabinets = await prisma.cabinet.findMany({
        where: { status: 'APPROVED' },
        select: { cabinetCode: true },
      });
      for (const cab of cabinets) {
        publish(TOPICS.cabinetCommand(cab.cabinetCode), {
          action: 'ping',
          msgId: `ping-${Date.now()}`
        });
      }
    } catch (err) {
      console.error('[mqtt-worker ping task error]', err.message);
    }
  }, 5000);

  return client;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startMqttWorker();
}
