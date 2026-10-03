import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const sw = fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');

describe('service worker source', () => {
  it('is push-only: does NOT register a fetch handler', () => {
    // A navigation-intercepting SW wedges repeat loads on iOS. Never intercept.
    expect(sw).not.toMatch(/addEventListener\(\s*['"]fetch['"]/);
    expect(sw).not.toMatch(/respondWith/);
  });

  it('uses NO Cache API (caches.* can hang in iOS standalone)', () => {
    // Root cause of "PWA opens once then hangs": Cache API stalls in WKWebView
    // standalone, freezing SW activation for the whole origin. Keep it absent.
    expect(sw).not.toMatch(/caches\./);
    expect(sw).not.toMatch(/\bcache\.(open|match|put|keys|delete)/);
  });

  it('takes control without blocking (skipWaiting + clients.claim)', () => {
    expect(sw).toMatch(/skipWaiting/);
    expect(sw).toMatch(/clients\.claim/);
  });

  it('has push and notificationclick handlers', () => {
    expect(sw).toMatch(/addEventListener\(\s*['"]push['"]/);
    expect(sw).toMatch(/addEventListener\(\s*['"]notificationclick['"]/);
    expect(sw).toMatch(/showNotification/);
  });
});
