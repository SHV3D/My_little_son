import { Router, Request, Response } from 'express';
import { getSettings, updateSettings } from '../services/settingsService';
import { optionalAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(optionalAuth);

router.get('/', (req: Request, res: Response) => {
  try {
    const childId = (req.query.childId as string) || req.user?.childId || 'demo-child-1';
    const settings = getSettings(childId);
    res.json(settings);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Ошибка получения настроек' });
  }
});

router.put('/', (req: Request, res: Response) => {
  try {
    const childId = (req.body.childId as string) || (req.query.childId as string) || req.user?.childId || 'demo-child-1';
    const updated = updateSettings(childId, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Ошибка обновления настроек' });
  }
});

export default router;
