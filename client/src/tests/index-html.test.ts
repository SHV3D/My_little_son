import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');

describe('index.html PWA wiring', () => {
  it('links manifest unconditionally (not iOS-gated)', () => {
    expect(html).toMatch(/<link[^>]+rel=["']manifest["']/);
    expect(html).not.toMatch(/iPad\|iPhone\|iPod/);
  });

  // Service worker is intentionally disabled: a registered SW white-screens the
  // installed PWA on iOS standalone. The page must NOT register a SW and must
  // actively unregister any previously installed one.
  it('does not register a service worker', () => {
    expect(html).not.toMatch(/serviceWorker\.register/);
  });
  it('unregisters any existing service worker', () => {
    expect(html).toMatch(/getRegistrations/);
    expect(html).toMatch(/\.unregister\(/);
  });
});
