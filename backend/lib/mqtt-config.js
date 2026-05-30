const DEFAULT_PORT = 8883;

export function getMqttConfig(connectTimeout = 6000, reconnectPeriod = 0) {
  const explicitUrl = process.env.MQTT_URL || '';
  const rawHost = String(process.env.MQTT_HOST || '').trim();
  const rawPort = process.env.MQTT_PORT;
  const sanitizedHost = rawHost.replace(/^mqtts?:\/\//, '').replace(/^wss?:\/\//, '').split('/')[0];
  const [hostname, embeddedPort] = sanitizedHost.split(':');
  const port = parseInt(rawPort || embeddedPort || String(DEFAULT_PORT), 10);
  const protocol = process.env.MQTT_PROTOCOL || (port === 1883 ? 'mqtt' : 'mqtts');
  const url = explicitUrl || `${protocol}://${hostname}:${port}`;
  const rejectUnauthorized = protocol === 'mqtts' && process.env.MQTT_REJECT_UNAUTHORIZED !== 'false';

  console.log('[mqtt-config] RESOLVED:', { host: hostname, port, protocol, url });

  return {
    url,
    displayUrl: url.replace(/:\/\/[^:@/]+:[^@/]+@/, '://***:***@'),
    options: {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      rejectUnauthorized,
      reconnectPeriod,
      connectTimeout,
    },
  };
}
