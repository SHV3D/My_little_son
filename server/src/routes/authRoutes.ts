import { Router, Request, Response } from 'express';
import { registerUser, loginUser, getCurrentUserProfile, resetPassword } from '../services/authService';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', (req: Request, res: Response) => {
  try {
    const result = registerUser(req.body);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Ошибка регистрации' });
  }
});

router.post('/login', (req: Request, res: Response) => {
  try {
    const result = loginUser(req.body);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Ошибка входа' });
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, recoveryCode, newPassword } = req.body;
    const result = await resetPassword({ email, recoveryCode, newPassword });
    res.status(200).json(result);
  } catch (err: any) {
    if (err.message && err.message.includes('не найден')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message || 'Ошибка восстановления пароля' });
  }
});

router.get('/me', requireAuth, (req: Request, res: Response) => {
  try {
    const profile = getCurrentUserProfile(req.user!.userId);
    res.json(profile);
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Профиль не найден' });
  }
});

export default router;
