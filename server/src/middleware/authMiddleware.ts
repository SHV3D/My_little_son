import { Request, Response, NextFunction } from 'express';
import { verifyJwtToken, UserTokenPayload } from '../services/authService';

declare global {
  namespace Express {
    interface Request {
      user?: UserTokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Необходима авторизация' });
    return;
  }

  const token = authHeader.substring(7).trim();
  try {
    const payload = verifyJwtToken(token);
    req.user = payload;
    next();
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Недействительный токен' });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      const payload = verifyJwtToken(token);
      req.user = payload;
    } catch {
      // Ignored for optional auth
    }
  }
  next();
}
