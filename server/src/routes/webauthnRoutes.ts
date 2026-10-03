import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import {
  createRegistrationOptions,
  verifyRegistration,
  createAuthOptions,
  verifyAuthentication,
} from '../services/webauthnService';

const router = Router();

router.post('/register/options', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await createRegistrationOptions(req.user!.userId, req.user!.email, req.user!.name));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/register/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await verifyRegistration(req.user!.userId, req.body));
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
});

router.post('/auth/options', async (req: Request, res: Response) => {
  try {
    const { options } = await createAuthOptions(req.body.email || '');
    res.json(options);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/auth/verify', async (req: Request, res: Response) => {
  try {
    res.json(await verifyAuthentication(req.body));
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
});

export default router;
