# Locker System

Monorepo layout:

- `frontend/`: React + Vite UI.
- `backend/`: Node HTTP API, static frontend serving, and MQTT worker.
- `prisma/`: Prisma schema and seed.
- `esp32.ino`: ESP32 cabinet firmware.

## Local development

Run backend API/static server:

```bash
MQTT_WORKER_ENABLED=false npm run dev:backend
```

Run frontend Vite dev server in another terminal:

```bash
npm run dev:frontend
```

Vite proxies `/api` to `http://127.0.0.1:3000`.

## Production / Coolify

Use the included `Dockerfile`. The container listens on port `3000` and runs:

```bash
npm run start
```

Set these environment variables in Coolify:

```bash
DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/DATABASE?sslaccept=strict
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
MQTT_HOST=xxxxxxxx.s1.eu.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=your-hivemq-username
MQTT_PASSWORD=your-hivemq-password
MQTT_WORKER_ENABLED=true
PORT=3000
```

Before first production run, apply schema changes against the database:

```bash
npm run db:push
```

The backend process also starts the MQTT worker by default. Set `MQTT_WORKER_ENABLED=false` only when running a separate MQTT worker process.

feat: CI/CD test 
