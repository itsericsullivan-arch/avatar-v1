import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.OPENAI_API_KEY;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const baseInstructions = `You are a capable, conversational AI assistant represented in this app by a fictional visual avatar. Be helpful, natural, direct, and concise unless the user asks for detail. Do not claim the visual avatar is a real human. The avatar's appearance is presentation only. Keep continuity within this Realtime session. If the user asks what you are, explain that you are an AI assistant in a custom avatar interface.`;

function safetyIdentifier(req) {
  const raw = `${req.socket.remoteAddress || 'local'}:${req.headers['user-agent'] || 'browser'}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function createRealtimeSession(req, res) {
  if (!API_KEY) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'OPENAI_API_KEY is not set on the server.' }));
    return;
  }

  const sdp = (await readBody(req)).toString('utf8');
  if (!sdp) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing SDP offer.' }));
    return;
  }

  const sessionConfig = {
    type: 'realtime',
    model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1',
    instructions: baseInstructions,
    output_modalities: ['audio'],
    audio: {
      input: {
        turn_detection: { type: 'semantic_vad' },
      },
      output: {
        voice: process.env.OPENAI_VOICE || 'marin',
      },
    },
  };

  const fd = new FormData();
  fd.set('sdp', sdp);
  fd.set('session', JSON.stringify(sessionConfig));

  try {
    const upstream = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'OpenAI-Safety-Identifier': safetyIdentifier(req),
      },
      body: fd,
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      console.error('OpenAI Realtime session error:', upstream.status, text);
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'OpenAI Realtime session creation failed.', detail: text }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/sdp' });
    res.end(text);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Could not reach OpenAI Realtime API.' }));
  }
}

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  } catch {
    pathname = '/';
  }
  if (pathname === '/') pathname = '/index.html';

  const candidate = path.normalize(path.join(__dirname, pathname));
  if (!candidate.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(candidate, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(candidate).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' || ext === '.js' ? 'no-store' : 'public, max-age=3600',
    });
    fs.createReadStream(candidate).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, apiKeyConfigured: Boolean(API_KEY) }));
    return;
  }

  if (req.method === 'POST' && req.url === '/session') {
    await createRealtimeSession(req, res);
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Method not allowed');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Avatar V1 running at http://localhost:${PORT}`);
  console.log(API_KEY ? 'OpenAI Realtime is configured.' : 'OPENAI_API_KEY is missing; UI will load but live voice cannot connect.');
});
