import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { getOrCreateVapidKeys } from '../services/pushConfigService';
import { saveSubscription, removeSubscription } from '../services/pushSubscriptionService';

const router = Router();
router.get('/vapid-public-key', (_req: Request, res: Response) => {
  res.json({ key: getOrCreateVapidKeys().publicKey });
});
router.post('/subscribe', requireAuth, (req: Request, res: Response) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) return res.status(400).json({ error: 'Некорректная подписка' });
  saveSubscription(req.user!.userId, req.user!.familyId, { endpoint, keys });
  res.status(201).json({ success: true });
});
router.post('/unsubscribe', requireAuth, (req: Request, res: Response) => {
  const { endpoint } = req.body || {};
  if (endpoint) removeSubscription(endpoint);
  res.json({ success: true });
});
export default router;
