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
import { setupWebSocketServer } from './ws/wsServer';

const app = express();
const PORT = process.env.PORT || 3001;

app.enable('trust proxy');

// Redirect HTTP to HTTPS for domain requests behind reverse proxies (Nginx/Passenger)
app.use((req: Request, res: Response, next) => {
  const host = req.headers.host || '';
  if (host.includes('shved.su')) {
    const isHttps =
      req.secure ||
      req.headers['x-forwarded-proto'] === 'https' ||
      req.headers['x-forwarded-ssl'] === 'on';

    if (!isHttps) {
      return res.redirect(301, `https://${host}${req.url}`);
    }
  }
  next();
});

app.use(cors());
app.use(express.json());

// Initialize database if not already done
if (process.env.NODE_ENV !== 'test') {
  initDatabase();
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sleep', sleepRoutes);
app.use('/api/calendar', calendarRoutes);

// Static files from built client for production
const candidateDistPaths = [
  path.resolve(__dirname, '../../../../client/dist'),
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), 'dist'),
];
const clientDistPath = candidateDistPaths.find((p) => fs.existsSync(p)) || candidateDistPaths[0];

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // Ensure any iOS SpringBoard icon request always receives a valid PNG
  app.get('/apple-touch-icon*.png', (_req: Request, res: Response) => {
    const iconPath = path.join(clientDistPath, 'apple-touch-icon.png');
    if (fs.existsSync(iconPath)) {
      return res.sendFile(iconPath);
    }
    res.status(404).send('Icon not found');
  });

  app.get('*', (req: Request, res: Response, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    // Return 404 for missing static assets (e.g. .js, .css, .png) instead of serving index.html
    if (path.extname(req.path)) {
      return res.status(404).send('Asset not found');
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const server = http.createServer(app);
const wss = setupWebSocketServer(server);

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export { server, wss, app };
export default app;
