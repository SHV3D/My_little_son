export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: 'Мама' | 'Папа' | 'Другое';
  familyId: string;
}

export interface FamilyDto {
  id: string;
  name: string;
  inviteCode: string;
}

export interface ChildDto {
  id: string;
  name: string;
}

export interface AuthResponse {
  user: UserDto;
  family: FamilyDto;
  child: ChildDto | null;
  token: string;
}

export interface LoginInput {
  email: string;
  password: string;
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

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage restriction errors
  }
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

export function getAuthToken(): string | null {
  return safeGetItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  safeSetItem(TOKEN_KEY, token);
}

export function clearAuthSession(): void {
  safeRemoveItem(TOKEN_KEY);
  safeRemoveItem(USER_KEY);
}

export function getStoredUser(): UserDto | null {
  const raw = safeGetItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserDto): void {
  safeSetItem(USER_KEY, JSON.stringify(user));
}

export async function loginApi(input: LoginInput): Promise<AuthResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Неверный адрес эл. почты или пароль');
  }

  const data: AuthResponse = await res.json();
  setAuthToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function registerApi(input: RegisterInput): Promise<AuthResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Ошибка регистрации');
  }

  const data: AuthResponse = await res.json();
  setAuthToken(data.token);
  setStoredUser(data.user);
  return data;
}

export async function fetchMeApi(): Promise<{ user: UserDto; family: FamilyDto; child: ChildDto | null }> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch('/api/auth/me', { headers });

  if (!res.ok) {
    clearAuthSession();
    throw new Error('Сессия истекла');
  }

  return res.json();
}

export interface ResetPasswordInput {
  email: string;
  recoveryCode: string;
  newPassword: string;
}

export async function resetPasswordApi(data: ResetPasswordInput): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Ошибка восстановления пароля');
  }

  return res.json();
}
