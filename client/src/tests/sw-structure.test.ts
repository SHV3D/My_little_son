import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const sw = fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');

describe('service worker source', () => {
  it('is push-only: does NOT register a fetch handler', () => {
    // Root-cause fix for the iOS "opens once, then hangs on reload" bug: a
    // navigation-intercepting SW stalls repeat loads on iOS. The SW must never
    // intercept fetch — no fetch listener, no respondWith anywhere.
    expect(sw).not.toMatch(/addEventListener\(\s*['"]fetch['"]/);
    expect(sw).not.toMatch(/respondWith/);
  });

  it('takes control immediately (skipWaiting + clients.claim)', () => {
    expect(sw).toMatch(/skipWaiting/);
    expect(sw).toMatch(/clients\.claim/);
  });

  it('purges all old caches on activate (clears stale cached HTML)', () => {
    expect(sw).toMatch(/caches\.keys\(\)/);
    expect(sw).toMatch(/caches\.delete/);
  });

  it('has push and notificationclick handlers', () => {
    expect(sw).toMatch(/addEventListener\(\s*['"]push['"]/);
    expect(sw).toMatch(/addEventListener\(\s*['"]notificationclick['"]/);
    expect(sw).toMatch(/showNotification/);
  });
});
