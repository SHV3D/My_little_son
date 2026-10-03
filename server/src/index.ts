import http from 'http';
import path from 'path';
import fs from 'fs';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { initDatabase } from './db/database';
import authRoutes from './routes/authRoutes';
import settingsRoutes from './routes/settingsRoutes';
import sleepRoutes from './routes/sleepRoutes';
import calendarRoutes from './routes/calendarRoutes';
import pushRoutes from './routes/pushRoutes';
import webauthnRoutes from './routes/webauthnRoutes';
import { configureWebPush } from './services/pushConfigService';
import { setupWebSocketServer } from './ws/wsServer';

const app = express();
const PORT = process.env.PORT || 3001;

app.enable('trust proxy');

app.use((req, res, next) => {
  const host = req.headers.host || '';
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  // Only act on an EXPLICIT proxy-reported scheme. Beget's Passenger serves the
  // app over a local socket WITHOUT x-forwarded-proto; falling back to
  // req.protocol there reports "http" for TLS-terminated requests and causes an
  // infinite redirect loop. When the header is absent, do nothing and let the
  // web server / Beget panel enforce HTTPS.
  const xfProto = req.headers['x-forwarded-proto'] as string | undefined;
  if (!isLocal && xfProto === 'http') {
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  if (!isLocal && xfProto === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(cors());
app.use(express.json());

// Initialize database if not already done
if (process.env.NODE_ENV !== 'test') {
  initDatabase();
  configureWebPush();
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sleep', sleepRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/webauthn', webauthnRoutes);

// Static files from built client for production
const candidateDistPaths = [
  path.resolve(__dirname, '../../../../client/dist'),
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), 'dist'),
];
const clientDistPath = candidateDistPaths.find((p) => fs.existsSync(p)) || candidateDistPaths[0];

if (fs.existsSync(clientDistPath)) {
  // Ensure manifest is served with proper content-type
  app.get('/manifest.json', (_req: Request, res: Response) => {
    const manifestPath = path.join(clientDistPath, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      res.setHeader('Content-Type', 'application/manifest+json; charset=UTF-8');
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      return res.sendFile(manifestPath);
    }
    res.status(404).send('Manifest not found');
  });

  app.get(['/sw.js', '/service-worker.js'], (_req: Request, res: Response) => {
    const swPath = path.join(clientDistPath, 'sw.js');
    if (fs.existsSync(swPath)) {
      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Service-Worker-Allowed', '/');
      return res.sendFile(swPath);
    }
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(404).send('Service worker not built');
  });

  // Ensure any iOS SpringBoard icon request (with or without .png, with or without -precomposed, or sizes) always receives a valid PNG
  app.get('/apple-touch-icon*', (req: Request, res: Response) => {
    const rawName = path.basename(req.path);
    const fileName = rawName.endsWith('.png') ? rawName : `${rawName}.png`;
    const requestedPath = path.join(clientDistPath, fileName);
    const default180Path = path.join(clientDistPath, 'apple-touch-icon-180x180.png');
    const defaultIconPath = path.join(clientDistPath, 'apple-touch-icon.png');

    let filePath = defaultIconPath;
    if (fs.existsSync(requestedPath)) {
      filePath = requestedPath;
    } else if (fs.existsSync(default180Path)) {
      filePath = default180Path;
    }

    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(filePath);
    }
    res.status(404).send('Icon not found');
  });

  // Serve hashed assets with their normal caching, but DO NOT let static serve
  // the HTML app shell (index:false) — the shell is served below with no-store.
  app.use(express.static(clientDistPath, { index: false }));

  app.get('*', (req: Request, res: Response, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    // Return 404 for missing static assets (e.g. .js, .css, .png) instead of serving index.html
    if (path.extname(req.path)) {
      return res.status(404).send('Asset not found');
    }
    // Serve the SPA shell with no-store and NO validators (etag/last-modified).
    // iOS standalone (WKWebView) mishandles a 304 on the app shell and renders a
    // blank page on the second launch; forcing a fresh 200 every time avoids it.
    res.sendFile(path.join(clientDistPath, 'index.html'), {
      etag: false,
      lastModified: false,
      cacheControl: false,
      headers: { 'Cache-Control': 'no-store, must-revalidate' },
    });
  });
}

const server = http.createServer(app);
const wss = setupWebSocketServer(server);

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
  setInterval(() => {
    import('./services/pushDispatchService').then((m) => m.dispatchAllFamilies().catch(() => {}));
  }, 60_000);
}

export { server, wss, app };
export default app;
