'use strict';
/**
 * Mandafia Services website server.
 * Serves the static pages in /public and handles POST /api/contact.
 * Uses only Node.js built-in modules, so there is nothing to npm install.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

try { process.loadEnvFile(path.join(__dirname, '.env')); } catch (e) { /* .env is optional; production uses real environment variables */ }

const { sendMail } = require('./mailer');

const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 3000;
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR || 5);
const MAX_BODY = 20 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/* ---------- contact form ---------- */

const hits = new Map(); // ip -> [timestamps]
setInterval(() => {
  const cutoff = Date.now() - 3600 * 1000;
  for (const [ip, list] of hits) {
    const kept = list.filter((t) => t > cutoff);
    if (kept.length) hits.set(ip, kept); else hits.delete(ip);
  }
}, 10 * 60 * 1000).unref();

const clean = (v, max) => String(v ?? '').replace(/[\r\n\0]+/g, ' ').trim().slice(0, max);

function clientIp(req) {
  // Best-effort: behind a CDN or proxy the real visitor IP arrives in a header
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return String(cf).trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooBig = false;
    const chunks = [];
    req.on('data', (c) => {
      if (tooBig) return; // drop the rest; the 413 reply closes the connection
      size += c.length;
      if (size > MAX_BODY) { tooBig = true; reject(Object.assign(new Error('Body too large'), { status: 413 })); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleContact(req, res) {
  let body;
  try {
    const raw = await readBody(req);
    const type = String(req.headers['content-type'] || '');
    body = type.includes('application/json') ? JSON.parse(raw || '{}') : Object.fromEntries(new URLSearchParams(raw));
  } catch (err) {
    if (err.status === 413) {
      res.setHeader('Connection', 'close');
      res.on('finish', () => req.destroy());
      return sendJson(res, 413, { ok: false, message: 'Your message is too long.' });
    }
    return sendJson(res, 400, { ok: false, message: 'Bad request.' });
  }
  if (!body || typeof body !== 'object') return sendJson(res, 400, { ok: false, message: 'Bad request.' });

  // Honeypot: real visitors never fill this hidden field. Pretend success to bots.
  if (body.website) return sendJson(res, 200, { ok: true, message: 'Thank you! We will contact you shortly.' });

  const name = clean(body.name, 100);
  const email = clean(body.email, 150);
  const phone = clean(body.phone, 30);
  const service = clean(body.service, 80);
  const message = String(body.message ?? '').replace(/\0/g, '').trim().slice(0, 3000);

  if (!name || !message) return sendJson(res, 422, { ok: false, message: 'Please fill in your name and message.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return sendJson(res, 422, { ok: false, message: 'Please enter a valid email address.' });
  if (phone && !/^[+\d][\d\s-]{7,}$/.test(phone)) return sendJson(res, 422, { ok: false, message: 'Please enter a valid phone number.' });

  const ip = clientIp(req);
  const recent = (hits.get(ip) || []).filter((t) => t > Date.now() - 3600 * 1000);
  if (recent.length >= RATE_LIMIT) return sendJson(res, 429, { ok: false, message: 'Too many requests. Please try again later.' });

  try {
    await sendMail({ name, email, phone, service, message, ip });
  } catch (err) {
    console.error('Contact form email failed:', err.message);
    const fallback = process.env.TO_EMAIL ? ` Please call us or email ${process.env.TO_EMAIL}.` : '';
    return sendJson(res, 502, { ok: false, message: `Sorry, we could not send your message right now.${fallback}` });
  }

  recent.push(Date.now());
  hits.set(ip, recent);
  return sendJson(res, 200, { ok: true, message: `Thank you, ${name}! We have received your enquiry and will contact you within 24 hours.` });
}

/* ---------- static files ---------- */

async function findFile(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath); } catch (e) { return null; }
  if (p.includes('\0') || p.split('/').some((seg) => seg.startsWith('.'))) return null; // no dotfiles, no ".."

  const base = path.join(PUBLIC_DIR, p);
  if (base !== PUBLIC_DIR && !base.startsWith(PUBLIC_DIR + path.sep)) return null;

  const candidates = p.endsWith('/') || p === '' ? [path.join(base, 'index.html')] : [base, base + '.html', path.join(base, 'index.html')];
  for (const file of candidates) {
    try {
      const st = await fs.promises.stat(file);
      if (st.isFile()) return { file, size: st.size };
    } catch (e) { /* try next candidate */ }
  }
  return null;
}

function streamFile(req, res, status, { file, size }) {
  const ext = path.extname(file).toLowerCase();
  const isHtml = ext === '.html';
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': size,
    'Cache-Control': status === 200 && !isHtml ? 'public, max-age=3600' : 'no-cache',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

async function handleStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD, POST', ...SECURITY_HEADERS });
    return res.end('Method not allowed');
  }
  const found = await findFile(pathname);
  if (found) return streamFile(req, res, 200, found);

  const notFound = await findFile('/404.html');
  if (notFound) return streamFile(req, res, 404, notFound);
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
  res.end('Page not found');
}

/* ---------- server ---------- */

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');

    if (pathname === '/healthz') return sendJson(res, 200, { ok: true });
    if (pathname === '/api/contact') {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { ok: false, message: 'Method not allowed.' }); }
      return await handleContact(req, res);
    }
    if (pathname.startsWith('/api/')) return sendJson(res, 404, { ok: false, message: 'Not found.' });

    await handleStatic(req, res, pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); }
    res.end('Something went wrong.');
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Mandafia Services site listening on port ${PORT}`));

process.on('SIGTERM', () => server.close(() => process.exit(0)));