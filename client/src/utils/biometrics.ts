import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export const BIOMETRICS_ENABLED_KEY = 'mls_biometrics_enabled';
export const BIOMETRICS_EMAIL_KEY = 'mls_biometric_email';

export async function isBiometricsAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const PKC = (window as any).PublicKeyCredential;
  if (!PKC) return false;
  if (typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
    try {
      return await PKC.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }
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

export function getBiometricEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(BIOMETRICS_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function disableBiometrics(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(BIOMETRICS_ENABLED_KEY);
    localStorage.removeItem(BIOMETRICS_EMAIL_KEY);
  } catch {
    // Ignore storage errors
  }
}

export async function registerBiometrics(token: string): Promise<boolean> {
  let optRes: Response;
  try {
    optRes = await fetch('/api/webauthn/register/options', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return false;
  }
  if (!optRes.ok) return false;
  const options = await optRes.json();

  let attResp;
  try {
    // @simplewebauthn/browser v14: startRegistration takes a single object { optionsJSON }
    attResp = await startRegistration({ optionsJSON: options });
  } catch {
    return false;
  }

  let verifyRes: Response;
  try {
    verifyRes = await fetch('/api/webauthn/register/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(attResp),
    });
  } catch {
    return false;
  }
  const data = await verifyRes.json();
  if (!verifyRes.ok || !data.verified) return false;

  try {
    localStorage.setItem(BIOMETRICS_ENABLED_KEY, 'true');
  } catch {
    // Ignore storage errors
  }
  return true;
}

export interface BioAuthResult {
  token: string;
  user: any;
  family?: any;
  child?: any;
}

export async function authenticateWithBiometrics(email: string): Promise<BioAuthResult | null> {
  let optRes: Response;
  try {
    optRes = await fetch('/api/webauthn/auth/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  } catch {
    return null;
  }
  if (!optRes.ok) return null;
  const options = await optRes.json();

  let assertion;
  try {
    // @simplewebauthn/browser v14: startAuthentication takes a single object { optionsJSON }
    assertion = await startAuthentication({ optionsJSON: options });
  } catch {
    return null;
  }

  let verifyRes: Response;
  try {
    verifyRes = await fetch('/api/webauthn/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assertion),
    });
  } catch {
    return null;
  }
  if (!verifyRes.ok) return null;
  const data = await verifyRes.json();
  return data && data.token ? data : null;
}
