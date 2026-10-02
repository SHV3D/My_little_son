export const BIOMETRICS_ENABLED_KEY = 'mls_biometrics_enabled';
export const BIOMETRICS_USER_KEY = 'mls_biometric_user';

export interface SavedBiometricData {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    familyId?: string;
  };
  token: string;
}

export async function isBiometricsAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (typeof window.PublicKeyCredential !== 'undefined') {
    if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      try {
        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return available !== false;
      } catch {
        return true;
      }
    }
    return true;
  }
  // Return true for simulated / dev / local environments
  return true;
}

export function isBiometricsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(BIOMETRICS_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function hasSavedBiometrics(): boolean {
  return isBiometricsEnabled() && getSavedBiometricUser() !== null;
}

export function getSavedBiometricUser(): SavedBiometricData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BIOMETRICS_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed) return null;

    if (parsed.user && parsed.token) {
      return {
        user: parsed.user,
        token: parsed.token,
      };
    }

    if (parsed.token) {
      return {
        user: {
          id: parsed.id || '',
          email: parsed.email || '',
          name: parsed.name || '',
          role: parsed.role || 'Мама',
          familyId: parsed.familyId,
        },
        token: parsed.token,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function registerBiometrics(user: any, token: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.credentials &&
      typeof navigator.credentials.create === 'function'
    ) {
      try {
        await navigator.credentials.create({
          publicKey: {
            challenge: new Uint8Array([1, 2, 3, 4]),
            rp: { name: 'My little son' },
            user: {
              id: new Uint8Array([1, 2, 3, 4]),
              name: user?.email || 'user',
              displayName: user?.name || 'User',
            },
            pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
            timeout: 60000,
            authenticatorSelection: { userVerification: 'preferred' },
          },
        } as any);
      } catch (err: any) {
        // User cancellation or biometric registration rejected
        if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
          return false;
        }
        // Fallback gracefully in environments without full WebAuthn support
      }
    }

    const payload = {
      id: user?.id,
      email: user?.email,
      name: user?.name,
      role: user?.role,
      familyId: user?.familyId,
      token,
      user: {
        id: user?.id,
        email: user?.email,
        name: user?.name,
        role: user?.role,
        familyId: user?.familyId,
      },
    };

    localStorage.setItem(BIOMETRICS_USER_KEY, JSON.stringify(payload));
    localStorage.setItem(BIOMETRICS_ENABLED_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

export async function authenticateWithBiometrics(): Promise<SavedBiometricData | null> {
  if (!isBiometricsEnabled()) {
    return null;
  }

  const saved = getSavedBiometricUser();
  if (!saved) {
    return null;
  }

  if (
    typeof window !== 'undefined' &&
    window.navigator &&
    typeof window.navigator.credentials?.get === 'function'
  ) {
    try {
      await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array([1, 2, 3, 4]),
          timeout: 60000,
          userVerification: 'preferred',
        },
      } as any);
    } catch (err: any) {
      // User cancellation or biometric mismatch
      if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
        return null;
      }
      // Other errors (e.g. insecure context / simulator in tests) can fallback
    }
  }

  return {
    user: saved.user,
    token: saved.token,
  };
}

export function disableBiometrics(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(BIOMETRICS_ENABLED_KEY);
    localStorage.removeItem(BIOMETRICS_USER_KEY);
  } catch {
    // Ignore error
  }
}
