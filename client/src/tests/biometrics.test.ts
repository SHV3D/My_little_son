/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(async () => ({ id: 'cred' })),
  startAuthentication: vi.fn(async () => ({ id: 'cred' })),
}));

import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import * as bio from '../utils/biometrics';

describe('biometrics client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('isBiometricsEnabled is false and getBiometricEmail is null by default', () => {
    expect(bio.isBiometricsEnabled()).toBe(false);
    expect(bio.getBiometricEmail()).toBeNull();
  });

  it('registerBiometrics persists enabled only after server verify', async () => {
    (globalThis as any).fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ challenge: 'c' }) }) // options
      .mockResolvedValueOnce({ ok: true, json: async () => ({ verified: true }) }); // verify

    const ok = await bio.registerBiometrics('jwt');
    expect(ok).toBe(true);
    expect(bio.isBiometricsEnabled()).toBe(true);

    // startRegistration called with { optionsJSON } per @simplewebauthn/browser v14 signature
    expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: { challenge: 'c' } });

    const [optReq, verifyReq] = (globalThis.fetch as any).mock.calls;
    expect(optReq[0]).toBe('/api/webauthn/register/options');
    expect(optReq[1]).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer jwt' } });
    expect(verifyReq[0]).toBe('/api/webauthn/register/verify');
    expect(verifyReq[1]).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer jwt' } });
    expect(JSON.parse(verifyReq[1].body)).toEqual({ id: 'cred' });
  });

  it('registerBiometrics does not enable when server verify returns verified:false', async () => {
    (globalThis as any).fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ challenge: 'c' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ verified: false }) });

    const ok = await bio.registerBiometrics('jwt');
    expect(ok).toBe(false);
    expect(bio.isBiometricsEnabled()).toBe(false);
  });

  it('registerBiometrics returns false when options request fails', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    const ok = await bio.registerBiometrics('jwt');
    expect(ok).toBe(false);
    expect(bio.isBiometricsEnabled()).toBe(false);
  });

  it('registerBiometrics returns false when startRegistration throws (user cancels)', async () => {
    (startRegistration as any).mockRejectedValueOnce({ name: 'NotAllowedError' });
    (globalThis as any).fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ challenge: 'c' }) });

    const ok = await bio.registerBiometrics('jwt');
    expect(ok).toBe(false);
    expect(bio.isBiometricsEnabled()).toBe(false);
  });

  it('authenticateWithBiometrics returns auth payload', async () => {
    (globalThis as any).fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ challenge: 'c2' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'JWT', user: { id: 'u' } }) });

    const res = await bio.authenticateWithBiometrics('mama@mail.ru');
    expect(res && res.token).toBe('JWT');

    expect(startAuthentication).toHaveBeenCalledWith({ optionsJSON: { challenge: 'c2' } });

    const [optReq, verifyReq] = (globalThis.fetch as any).mock.calls;
    expect(optReq[0]).toBe('/api/webauthn/auth/options');
    expect(JSON.parse(optReq[1].body)).toEqual({ email: 'mama@mail.ru' });
    expect(verifyReq[0]).toBe('/api/webauthn/auth/verify');
  });

  it('authenticateWithBiometrics returns null when options request fails', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    const res = await bio.authenticateWithBiometrics('mama@mail.ru');
    expect(res).toBeNull();
  });

  it('authenticateWithBiometrics returns null when verify fails', async () => {
    (globalThis as any).fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ challenge: 'c2' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    const res = await bio.authenticateWithBiometrics('mama@mail.ru');
    expect(res).toBeNull();
  });

  it('authenticateWithBiometrics returns null when startAuthentication throws (user cancels)', async () => {
    (startAuthentication as any).mockRejectedValueOnce({ name: 'NotAllowedError' });
    (globalThis as any).fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ challenge: 'c2' }) });

    const res = await bio.authenticateWithBiometrics('mama@mail.ru');
    expect(res).toBeNull();
  });

  it('stores and clears BIOMETRICS_EMAIL_KEY via disableBiometrics', () => {
    localStorage.setItem(bio.BIOMETRICS_ENABLED_KEY, 'true');
    localStorage.setItem(bio.BIOMETRICS_EMAIL_KEY, 'mama@mail.ru');
    expect(bio.isBiometricsEnabled()).toBe(true);
    expect(bio.getBiometricEmail()).toBe('mama@mail.ru');

    bio.disableBiometrics();
    expect(bio.isBiometricsEnabled()).toBe(false);
    expect(bio.getBiometricEmail()).toBeNull();
  });

  it('isBiometricsAvailable reflects PublicKeyCredential platform authenticator availability', async () => {
    (window as any).PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
    };
    expect(await bio.isBiometricsAvailable()).toBe(true);

    (window as any).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = vi
      .fn()
      .mockResolvedValue(false);
    expect(await bio.isBiometricsAvailable()).toBe(false);

    delete (window as any).PublicKeyCredential;
    expect(await bio.isBiometricsAvailable()).toBe(false);
  });
});
