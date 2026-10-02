import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb, DbUser, DbFamily, DbChild } from '../db/database';

export const JWT_SECRET = process.env.JWT_SECRET || 'my-little-son-secret-key-2026';

export interface UserTokenPayload {
  userId: string;
  familyId: string;
  childId: string;
  role: 'Мама' | 'Папа' | 'Другое';
  email: string;
  name: string;
}

export interface RegisterInput {
  name: string;
  role: 'Мама' | 'Папа' | 'Другое';
  email: string;
  password: string;
  inviteCode?: string;
  familyName?: string;
  childName?: string;
  recoveryCode?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'Мама' | 'Папа' | 'Другое';
    familyId: string;
  };
  family: {
    id: string;
    name: string;
    inviteCode: string;
  };
  child: {
    id: string;
    name: string;
  } | null;
  token: string;
}

function generateInviteCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 3; i++) {
    part1 += chars[Math.floor(Math.random() * chars.length)];
    part2 += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${part1}-${part2}`;
}

export function registerUser(input: RegisterInput): AuthResponse {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const password = input.password;
  const role = input.role || 'Другое';

  if (!email || !email.includes('@')) {
    throw new Error('Укажите корректный адрес эл. почты');
  }
  if (!name) {
    throw new Error('Укажите ваше имя');
  }
  if (!password || password.length < 6) {
    throw new Error('Пароль должен содержать не менее 6 символов');
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    throw new Error('Пользователь с такой эл. почтой уже зарегистрирован');
  }

  let familyId = '';
  let familyName = '';
  let inviteCode = '';
  let childId = '';
  let childName = '';

  const userId = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);

  db.transaction(() => {
    if (input.inviteCode && input.inviteCode.trim()) {
      const code = input.inviteCode.trim().toUpperCase();
      const family = db.prepare('SELECT * FROM families WHERE invite_code = ?').get(code) as DbFamily | undefined;
      if (!family) {
        throw new Error('Неверный код приглашения');
      }
      familyId = family.id;
      familyName = family.name;
      inviteCode = family.invite_code;

      const child = db.prepare('SELECT * FROM children WHERE family_id = ? LIMIT 1').get(familyId) as DbChild | undefined;
      if (child) {
        childId = child.id;
        childName = child.name;
      } else {
        childId = crypto.randomUUID();
        childName = input.childName || 'Сын';
        db.prepare('INSERT INTO children (id, family_id, name, birth_date) VALUES (?, ?, ?, ?)').run(
          childId,
          familyId,
          childName,
          '2026-01-15'
        );
        db.prepare(`
          INSERT INTO child_settings (
            id, child_id, naps_per_day, wake_interval_min_minutes, wake_interval_max_minutes,
            total_wake_minutes, total_day_sleep_minutes, target_bedtime, typical_wakeup_time
          ) VALUES (?, ?, 3, 150, 180, 600, 200, '20:30', '07:00')
        `).run(crypto.randomUUID(), childId);
      }
    } else {
      familyId = crypto.randomUUID();
      familyName = input.familyName || 'Наша семья';
      inviteCode = generateInviteCode();
      const normalizedRecovery = input.recoveryCode ? input.recoveryCode.trim().toLowerCase() : null;

      db.prepare('INSERT INTO families (id, name, invite_code, recovery_code) VALUES (?, ?, ?, ?)').run(
        familyId,
        familyName,
        inviteCode,
        normalizedRecovery
      );

      childId = crypto.randomUUID();
      childName = input.childName || 'Сын';
      db.prepare('INSERT INTO children (id, family_id, name, birth_date) VALUES (?, ?, ?, ?)').run(
        childId,
        familyId,
        childName,
        '2026-01-15'
      );

      db.prepare(`
        INSERT INTO child_settings (
          id, child_id, naps_per_day, wake_interval_min_minutes, wake_interval_max_minutes,
          total_wake_minutes, total_day_sleep_minutes, target_bedtime, typical_wakeup_time
        ) VALUES (?, ?, 3, 150, 180, 600, 200, '20:30', '07:00')
      `).run(crypto.randomUUID(), childId);
    }

    db.prepare(`
      INSERT INTO users (id, family_id, email, password_hash, name, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, familyId, email, passwordHash, name, role);
  })();

  const payload: UserTokenPayload = {
    userId,
    familyId,
    childId,
    role,
    email,
    name,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

  return {
    user: {
      id: userId,
      email,
      name,
      role,
      familyId,
    },
    family: {
      id: familyId,
      name: familyName,
      inviteCode,
    },
    child: {
      id: childId,
      name: childName,
    },
    token,
  };
}

export function loginUser(input: LoginInput): AuthResponse {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    throw new Error('Укажите эл. почту и пароль');
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as DbUser | undefined;
  if (!user) {
    throw new Error('Неверная эл. почта или пароль');
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('Неверная эл. почта или пароль');
  }

  const family = db.prepare('SELECT * FROM families WHERE id = ?').get(user.family_id) as DbFamily | undefined;
  if (!family) {
    throw new Error('Семья пользователя не найдена');
  }

  const child = db.prepare('SELECT * FROM children WHERE family_id = ? LIMIT 1').get(user.family_id) as DbChild | undefined;

  const payload: UserTokenPayload = {
    userId: user.id,
    familyId: user.family_id,
    childId: child ? child.id : '',
    role: user.role,
    email: user.email,
    name: user.name,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      familyId: user.family_id,
    },
    family: {
      id: family.id,
      name: family.name,
      inviteCode: family.invite_code,
    },
    child: child ? {
      id: child.id,
      name: child.name,
    } : null,
    token,
  };
}

export function verifyJwtToken(token: string): UserTokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as UserTokenPayload;
  } catch {
    throw new Error('Недействительный или истекший токен авторизации');
  }
}

export function getCurrentUserProfile(userId: string) {
  const db = getDb();
  const user = db.prepare('SELECT id, family_id, email, name, role, created_at FROM users WHERE id = ?').get(userId) as Omit<DbUser, 'password_hash'> | undefined;
  if (!user) {
    throw new Error('Пользователь не найден');
  }

  const family = db.prepare('SELECT id, name, invite_code, created_at FROM families WHERE id = ?').get(user.family_id) as DbFamily | undefined;
  const children = db.prepare('SELECT id, name, birth_date FROM children WHERE family_id = ?').all(user.family_id) as DbChild[];
  const familyMembers = db.prepare('SELECT id, name, role, email FROM users WHERE family_id = ?').all(user.family_id) as Array<{ id: string; name: string; role: string; email: string }>;

  return {
    user,
    family,
    child: children.length > 0 ? children[0] : null,
    children,
    familyMembers,
  };
}

export async function resetPassword(input: {
  email: string;
  recoveryCode: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  const db = getDb();
  const email = (input.email || '').trim().toLowerCase();
  const recoveryCode = (input.recoveryCode || '').trim().toLowerCase();
  const newPassword = input.newPassword || '';

  if (!email) {
    throw new Error('Укажите эл. почту');
  }
  if (!recoveryCode) {
    throw new Error('Укажите кодовое слово семьи');
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Пароль должен содержать не менее 6 символов');
  }

  const user = db.prepare('SELECT id, family_id FROM users WHERE LOWER(email) = ?').get(email) as DbUser | undefined;
  if (!user) {
    throw new Error('Пользователь с таким email не найден');
  }

  const family = db.prepare('SELECT id, recovery_code FROM families WHERE id = ?').get(user.family_id) as DbFamily | undefined;
  if (!family || !family.recovery_code || family.recovery_code.trim().toLowerCase() !== recoveryCode) {
    throw new Error('Неверное кодовое слово семьи');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);

  return { success: true, message: 'Пароль успешно изменён' };
}
