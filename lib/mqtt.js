import mqtt from 'mqtt';

const MQTT_OPTIONS = {
  host: process.env.MQTT_HOST,
  port: parseInt(process.env.MQTT_PORT || '8883', 10),
  protocol: 'mqtts',
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  connectTimeout: 6000,
  reconnectPeriod: 0, // disable auto-reconnect in serverless
  rejectUnauthorized: true,
};

// ─── Topic helpers ─────────────────────────────────────────────
export const TOPICS = {
  command: (lockerId) => `lockersystem/locker/${lockerId}/command`,
  status:  (lockerId) => `lockersystem/locker/${lockerId}/status`,
  all:     () => 'lockersystem/locker/+/status',
};

/**
 * Publish a command to an ESP32 locker via HiveMQ.
 * Connects → publishes → disconnects (fire-and-forget, serverless-safe).
 *
 * @param {string} lockerId  — e.g. "A-001"
 * @param {object} payload   — e.g. { action: "unlock", method: "qr", userId: 1 }
 * @param {number} timeout   — ms to wait (default 6000)
 */
export async function publishCommand(lockerId, payload, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(
      `mqtts://${MQTT_OPTIONS.host}:${MQTT_OPTIONS.port}`,
      MQTT_OPTIONS
    );

    const timer = setTimeout(() => {
      client.end(true);
      reject(new Error('MQTT connection timeout'));
    }, timeout);

    client.on('connect', () => {
      const topic = TOPICS.command(lockerId);
      const message = JSON.stringify({
        ...payload,
        lockerId,
        ts: Date.now(),
      });

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

/**
 * Check MQTT broker connectivity (for health check).
 */
export async function pingBroker() {
  return new Promise((resolve) => {
    const client = mqtt.connect(
      `mqtts://${MQTT_OPTIONS.host}:${MQTT_OPTIONS.port}`,
      { ...MQTT_OPTIONS, connectTimeout: 3000 }
    );
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
