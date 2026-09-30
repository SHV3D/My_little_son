import { Router, Request, Response } from 'express';
import {
  getDayStatus,
  recordFellAsleep,
  recordWokeUp,
  recordRetroactive,
  deleteSleepEvent,
  updateSleepEvent,
} from '../services/sleepService';
import { optionalAuth } from '../middleware/authMiddleware';
import { broadcastToFamily, getFamilyIdForChild } from '../ws/wsServer';

const router = Router();

router.use(optionalAuth);

router.get('/status', (req: Request, res: Response) => {
  try {
    const childId = (req.query.childId as string) || req.user?.childId || 'demo-child-1';
    const date = (req.query.date as string) || undefined;
    const currentTime = (req.query.currentTime as string) || undefined;

    const status = getDayStatus(childId, date, currentTime);
    res.json(status);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Ошибка получения статуса' });
  }
});

router.post('/fell-asleep', (req: Request, res: Response) => {
  try {
    const childId = req.body.childId || req.user?.childId || 'demo-child-1';
    const userId = req.user?.userId || 'demo-user-mama';
    const userName = req.user?.name || req.body.userName || 'Мама';
    const time = req.body.time;
    const source = req.body.source || 'NOW';

    const result = recordFellAsleep(childId, userId, userName, time, source);
    const familyId = req.user?.familyId || getFamilyIdForChild(childId);
    if (familyId) {
      broadcastToFamily(familyId, {
        type: 'SLEEP_STATUS_CHANGED',
        payload: {
          childId,
          action: 'FELL_ASLEEP',
          timestamp: new Date().toISOString(),
          result,
        },
      });
    }
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Ошибка фиксации засыпания' });
  }
});

router.post('/woke-up', (req: Request, res: Response) => {
  try {
    const childId = req.body.childId || req.user?.childId || 'demo-child-1';
    const userId = req.user?.userId || 'demo-user-mama';
    const userName = req.user?.name || req.body.userName || 'Мама';
    const time = req.body.time;
    const source = req.body.source || 'NOW';

    const result = recordWokeUp(childId, userId, userName, time, source);
    const familyId = req.user?.familyId || getFamilyIdForChild(childId);
    if (familyId) {
      broadcastToFamily(familyId, {
        type: 'SLEEP_STATUS_CHANGED',
        payload: {
          childId,
          action: 'WOKE_UP',
          timestamp: new Date().toISOString(),
          result,
        },
      });
    }
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Ошибка фиксации пробуждения' });
  }
});

router.post('/retroactive', (req: Request, res: Response) => {
  try {
    const childId = req.body.childId || req.user?.childId || 'demo-child-1';
    const userId = req.user?.userId || 'demo-user-mama';
    const userName = req.user?.name || req.body.userName || 'Мама';

    if (!req.body.date || !req.body.eventType || !req.body.startTime) {
      res.status(400).json({ error: 'Необходимо указать дату, тип события и время начала' });
      return;
    }

    const result = recordRetroactive(childId, userId, userName, {
      date: req.body.date,
      eventType: req.body.eventType,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      napNumber: req.body.napNumber,
      source: req.body.source || 'RETROACTIVE',
    });
    const familyId = req.user?.familyId || getFamilyIdForChild(childId);
    if (familyId) {
      broadcastToFamily(familyId, {
        type: 'SLEEP_STATUS_CHANGED',
        payload: {
          childId,
          action: 'RETROACTIVE',
          timestamp: new Date().toISOString(),
          result,
        },
      });
    }
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Ошибка добавления сна задним числом' });
  }
});

router.delete('/events/:id', (req: Request, res: Response) => {
  try {
    const childId = (req.query.childId as string) || req.user?.childId || 'demo-child-1';
    const eventId = req.params.id;
    const result = deleteSleepEvent(eventId, childId);
    const familyId = req.user?.familyId || getFamilyIdForChild(childId);
    if (familyId) {
      broadcastToFamily(familyId, {
        type: 'SLEEP_STATUS_CHANGED',
        payload: {
          childId,
          eventId,
          action: 'DELETE_EVENT',
          timestamp: new Date().toISOString(),
          result,
        },
      });
    }
    res.json(result);
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Ошибка удаления записи' });
  }
});

router.put('/events/:id', (req: Request, res: Response) => {
  try {
    const childId = (req.query.childId as string) || (req.body.childId as string) || req.user?.childId || 'demo-child-1';
    const eventId = req.params.id;
    const result = updateSleepEvent(eventId, childId, {
      eventType: req.body.eventType,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      napNumber: req.body.napNumber,
      date: req.body.date,
    });

    const familyId = req.user?.familyId || getFamilyIdForChild(childId);
    if (familyId) {
      broadcastToFamily(familyId, {
        type: 'SLEEP_STATUS_CHANGED',
        payload: {
          childId,
          eventId,
          action: 'UPDATE_EVENT',
          timestamp: new Date().toISOString(),
          result,
        },
      });
    }

    res.json(result);
  } catch (err: any) {
    const status = err.message === 'Запись о сне не найдена' ? 404 : 400;
    res.status(status).json({ error: err.message || 'Ошибка обновления записи' });
  }
});

export default router;
