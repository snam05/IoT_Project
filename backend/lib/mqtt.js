import mqtt from 'mqtt';
import { parseLockerId } from './cabinet.js';
import { getMqttConfig } from './mqtt-config.js';

export const TOPICS = {
  command: (lockerId) => `lockersystem/locker/${lockerId}/command`,
  status: (lockerId) => `lockersystem/locker/${lockerId}/status`,
  all: () => 'lockersystem/locker/+/status',
  cabinetHello: (cabinetCode = '+') => `lockersystem/cabinet/${cabinetCode}/hello`,
  cabinetRegistration: (cabinetCode) => `lockersystem/cabinet/${cabinetCode}/registration`,
  cabinetOtpRequest: (cabinetCode = '+') => `lockersystem/cabinet/${cabinetCode}/otp/request`,
  cabinetOtpResponse: (cabinetCode) => `lockersystem/cabinet/${cabinetCode}/otp/response`,
  cabinetCommand: (cabinetCode) => `lockersystem/cabinet/${cabinetCode}/command`,
};

function connectClient(timeout = 6000) {
  const config = getMqttConfig(timeout, 0);
  return mqtt.connect(config.url, config.options);
}

export async function publishTopic(topic, payload, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const client = connectClient(timeout);
    const timer = setTimeout(() => {
      client.end(true);
      reject(new Error('MQTT connection timeout'));
    }, timeout);

    client.on('connect', () => {
      const message = JSON.stringify({ ...payload, ts: Date.now() });
      client.publish(topic, message, { qos: 1, retain: false }, (err) => {
        clearTimeout(timer);
        client.end();
        if (err) reject(err);
        else resolve({ topic, message });
      });
    });

    client.on('error', (err) => {
      clearTimeout(timer);
      client.end(true);
      reject(err);
    });
  });
}

export async function publishCommand(lockerId, payload, timeout = 6000) {
  const parsed = parseLockerId(lockerId);
  const topic = parsed ? TOPICS.cabinetCommand(parsed.cabinetCode) : TOPICS.command(lockerId);
  return publishTopic(topic, {
    ...payload,
    lockerId,
    msgId: String(Date.now()) + "-" + String(Math.floor(Math.random() * 1000)),
    ...(parsed ? { cabinetCode: parsed.cabinetCode, compartmentNo: parsed.compartmentNo } : {}),
  }, timeout);
}

export async function publishCabinetRegistration(cabinetCode, payload, timeout = 6000) {
  return publishTopic(TOPICS.cabinetRegistration(cabinetCode), payload, timeout);
}

export async function publishCabinetOtp(cabinetCode, payload, timeout = 6000) {
  return publishTopic(TOPICS.cabinetOtpResponse(cabinetCode), payload, timeout);
}

export async function pingBroker() {
  return new Promise((resolve) => {
    const client = connectClient(3000);
    const timer = setTimeout(() => { client.end(true); resolve(false); }, 4000);
    client.on('connect', () => {
      clearTimeout(timer);
      client.end();
      resolve(true);
    });
    client.on('error', () => {
      clearTimeout(timer);
      client.end(true);
      resolve(false);
    });
  });
}
