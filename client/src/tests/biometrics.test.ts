/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isBiometricsAvailable,
  isBiometricsEnabled,
  getSavedBiometricUser,
  registerBiometrics,
  authenticateWithBiometrics,
  disableBiometrics,
  BIOMETRICS_ENABLED_KEY,
  BIOMETRICS_USER_KEY,
} from '../utils/biometrics';

describe('Biometrics Utility', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('checks if biometrics is available', async () => {
    const available = await isBiometricsAvailable();
    expect(available).toBe(true);
  });

  it('returns false for isBiometricsEnabled when localStorage is empty', () => {
    expect(isBiometricsEnabled()).toBe(false);
  });

  it('registers biometrics and stores user and token in localStorage', async () => {
    const testUser = {
      id: 'user-mom-1',
      email: 'mama@mail.ru',
      name: 'Мама',
      role: 'Мама',
      familyId: 'demo-family-1',
    };
    const testToken = 'jwt-token-123';

    const registered = await registerBiometrics(testUser, testToken);
    expect(registered).toBe(true);

    expect(isBiometricsEnabled()).toBe(true);
    expect(localStorage.getItem(BIOMETRICS_ENABLED_KEY)).toBe('true');

    const saved = getSavedBiometricUser();
    expect(saved).not.toBeNull();
    expect(saved?.token).toBe(testToken);
    expect(saved?.user.id).toBe('user-mom-1');
    expect(saved?.user.email).toBe('mama@mail.ru');
  });

  it('authenticates with biometrics when enabled and credentials saved', async () => {
    const testUser = {
      id: 'user-mom-1',
      email: 'mama@mail.ru',
      name: 'Мама',
      role: 'Мама',
      familyId: 'demo-family-1',
    };
    const testToken = 'jwt-token-123';

    await registerBiometrics(testUser, testToken);

    const result = await authenticateWithBiometrics();
    expect(result).not.toBeNull();
    expect(result?.token).toBe(testToken);
    expect(result?.user.id).toBe('user-mom-1');
  });

  it('returns null when authenticating if biometrics is disabled or not set up', async () => {
    const result = await authenticateWithBiometrics();
    expect(result).toBeNull();
  });

  it('disables biometrics and removes items from localStorage', async () => {
    const testUser = { id: 'u1', email: 'u1@mail.ru', name: 'User 1', role: 'Мама', familyId: 'f1' };
    await registerBiometrics(testUser, 'tok-1');
    expect(isBiometricsEnabled()).toBe(true);

    disableBiometrics();
    expect(isBiometricsEnabled()).toBe(false);
    expect(localStorage.getItem(BIOMETRICS_ENABLED_KEY)).toBeNull();
    expect(localStorage.getItem(BIOMETRICS_USER_KEY)).toBeNull();
    expect(getSavedBiometricUser()).toBeNull();
  });
});
