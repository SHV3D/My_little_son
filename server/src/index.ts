import express, { Request, Response } from 'express';
import cors from 'cors';
import { initDatabase } from './db/database';
import authRoutes from './routes/authRoutes';
import settingsRoutes from './routes/settingsRoutes';
import sleepRoutes from './routes/sleepRoutes';
import calendarRoutes from './routes/calendarRoutes';

const app = express();
const PORT = process.env.PORT || 3001;

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

if (process.env.NODE_ENV !== 'test' && (!process.env.PORT || require.main === module)) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export default app;
