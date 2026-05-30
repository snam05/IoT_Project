import 'dotenv/config';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMqttWorker } from './mqtt-worker.js';

import authLogin from './api/auth/login.js';
import authLogout from './api/auth/logout.js';
import authMe from './api/auth/me.js';
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

const routes = [
  ['POST', /^\/api\/auth\/login\/?$/, authLogin],
  ['POST', /^\/api\/auth\/logout\/?$/, authLogout],
  ['GET', /^\/api\/auth\/me\/?$/, authMe],
  ['GET|PUT', /^\/api\/profile\/?$/, profile],
  ['GET', /^\/api\/lockers\/?$/, lockers],
  ['GET', /^\/api\/stats\/?$/, stats],
  ['GET', /^\/api\/lockers\/otp\/?$/, lockersOtp],
  ['POST', /^\/api\/lockers\/unlock\/?$/, lockersUnlock],
  ['GET|POST|PUT', /^\/api\/admin\/lockers\/?$/, adminLockers],
  ['GET|POST', /^\/api\/admin\/users\/?$/, adminUsers],
  ['GET|PUT|DELETE', /^\/api\/admin\/users\/([^/]+)\/?$/, adminUserById, ['id']],
  ['GET|PUT|DELETE', /^\/api\/admin\/cabinets\/?$/, adminCabinets],
  ['POST', /^\/api\/mqtt\/cabinet\/?$/, mqttCabinet],
  ['GET', /^\/api\/admin\/logs\/lockers\/?$/, adminLogsLockers],
  ['GET', /^\/api\/admin\/logs\/system\/?$/, adminLogsSystem],
];

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (!chunks.length) return resolve(undefined);
      const raw = Buffer.concat(chunks).toString('utf8');
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          return resolve(raw ? JSON.parse(raw) : undefined);
        } catch (err) {
          return reject(err);
        }
      }
      resolve(raw);
    });
    req.on('error', reject);
  });
}

function buildReq(req, url, body, params = {}) {
  return Object.assign(req, {
    query: { ...Object.fromEntries(url.searchParams.entries()), ...params },
    body,
  });
}

function buildRes(nodeRes) {
  return {
    statusCode: 200,
    setHeader(name, value) {
      nodeRes.setHeader(name, value);
      return this;
    },
    status(code) {
      this.statusCode = code;
      nodeRes.statusCode = code;
      return this;
    },
    json(payload) {
      if (!nodeRes.hasHeader('Content-Type')) nodeRes.setHeader('Content-Type', 'application/json; charset=utf-8');
      nodeRes.statusCode = this.statusCode;
      nodeRes.end(JSON.stringify(payload));
      return this;
    },
    end(payload = '') {
      nodeRes.statusCode = this.statusCode;
      nodeRes.end(payload);
      return this;
    },
  };
}

function matchRoute(method, pathname) {
  for (const [methods, pattern, handler, keys = []] of routes) {
    if (!methods.split('|').includes(method) && method !== 'OPTIONS') continue;
    const match = pathname.match(pattern);
    if (!match) continue;
    const params = Object.fromEntries(keys.map((key, index) => [key, match[index + 1]]));
    return { handler, params };
  }
  return null;
}

async function handleApi(req, res, url) {
  const matched = matchRoute(req.method, url.pathname);
  if (!matched) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'API route not found' }));
    return;
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  await matched.handler(buildReq(req, url, body, matched.params), buildRes(res));
}

async function sendFile(res, filePath) {
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error('Not a file');
  res.statusCode = 200;
  res.setHeader('Content-Type', mimeTypes[path.extname(filePath)] || 'application/octet-stream');
  res.setHeader('Content-Length', info.size);
  createReadStream(filePath).pipe(res);
}

async function handleStatic(req, res, url) {
  const decoded = decodeURIComponent(url.pathname);
  const safePath = path.normalize(decoded).replace(/^\.\.(\/|\\|$)/, '');
  const requested = path.join(publicDir, safePath === '/' ? 'index.html' : safePath);

  try {
    await sendFile(res, requested);
  } catch {
    try {
      const index = path.join(publicDir, 'index.html');
      const html = await readFile(index);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
    } catch {
      res.statusCode = 404;
      res.end('Build output not found. Run npm run build first.');
    }
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await handleStatic(req, res, url);
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Internal server error' }));
    } else {
      res.end();
    }
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[server] listening on 0.0.0.0:${port}`);
});

if (process.env.MQTT_WORKER_ENABLED !== 'false') {
  startMqttWorker();
}
