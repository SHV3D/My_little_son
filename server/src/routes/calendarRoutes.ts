import { Router, Request, Response } from 'express';
import { getMonthSummary } from '../services/sleepService';
import { optionalAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(optionalAuth);

router.get('/month', (req: Request, res: Response) => {
  try {
    const childId = (req.query.childId as string) || req.user?.childId || 'demo-child-1';
    const year = req.query.year ? parseInt(req.query.year as string, 10) : 2026;
    const month = req.query.month ? parseInt(req.query.month as string, 10) : 9;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      res.status(400).json({ error: 'Некорректный год или месяц' });
      return;
    }

    const summary = getMonthSummary(childId, year, month);
    res.json(summary);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Ошибка получения календаря' });
  }
});

export default router;
