import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMqttWorker } from './mqtt-worker.js';

import authLogin from './api/auth/login.js';
import authLogout from './api/auth/logout.js';
import authMe from './api/auth/me.js';
import authRegister from './api/auth/register.js';
import profile from './api/profile.js';
import lockers from './api/lockers.js';
import stats from './api/stats.js';
import lockersOtp from './api/lockers/otp.js';
import lockersUnlock from './api/lockers/unlock.js';
import adminLockers from './api/admin/lockers.js';
import adminUsers from './api/admin/users.js';
import adminUserById from './api/admin/users/[id].js';
import adminCabinets from './api/admin/cabinets.js';
import mqttCabinet from './api/mqtt/cabinet.js';
import adminLogsLockers from './api/admin/logs/lockers.js';
import adminLogsSystem from './api/admin/logs/system.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'dist', 'public');
const port = parseInt(process.env.PORT || '3000', 10);

const app = express();

// Enable JSON body parsing
app.use(express.json());

// Set security headers & CORS
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Map req.query from route params for controllers compatibility
app.use((req, res, next) => {
  if (req.params) {
    Object.assign(req.query, req.params);
  }
  next();
});

// API Routes
app.post('/api/auth/login', authLogin);
app.post('/api/auth/logout', authLogout);
app.get('/api/auth/me', authMe);
app.post('/api/auth/register', authRegister);

app.route('/api/profile')
  .get(profile)
  .put(profile);

app.get('/api/lockers', lockers);
app.get('/api/stats', stats);
app.get('/api/lockers/otp', lockersOtp);
app.post('/api/lockers/unlock', lockersUnlock);

app.route('/api/admin/lockers')
  .get(adminLockers)
  .post(adminLockers)
  .put(adminLockers);

app.route('/api/admin/users')
  .get(adminUsers)
  .post(adminUsers);

// Middleware to assign :id to req.query.id so [id].js controller works seamlessly
app.all('/api/admin/users/:id', (req, res, next) => {
  req.query.id = req.params.id;
  adminUserById(req, res, next);
});

app.route('/api/admin/cabinets')
  .get(adminCabinets)
  .put(adminCabinets)
  .delete(adminCabinets);

app.post('/api/mqtt/cabinet', mqttCabinet);
app.route('/api/admin/logs/lockers')
  .get(adminLogsLockers)
  .delete(adminLogsLockers);
app.route('/api/admin/logs/system')
  .get(adminLogsSystem)
  .delete(adminLogsSystem);

// Serve static files
app.use(express.static(publicDir));

// Fallback for Single Page Application routing (index.html)
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Build output not found. Run npm run build first.');
    }
  });
});

export const server = app;

export function startServer() {
  app.listen(port, '0.0.0.0', () => {
    console.log(`[server] Express listening on 0.0.0.0:${port}`);
  });

  if (process.env.MQTT_WORKER_ENABLED !== 'false') {
    startMqttWorker();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
