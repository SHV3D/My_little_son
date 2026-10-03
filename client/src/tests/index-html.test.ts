import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');

describe('index.html PWA wiring', () => {
  it('links manifest unconditionally (not iOS-gated)', () => {
    expect(html).toMatch(/<link[^>]+rel=["']manifest["']/);
    expect(html).not.toMatch(/iPad\|iPhone\|iPod/);
  });
  it('registers the service worker', () => {
    expect(html).toMatch(/serviceWorker\.register\(\s*['"]\/sw\.js['"]/);
  });
  it('does not unregister service workers', () => {
    expect(html).not.toMatch(/getRegistrations/);
    expect(html).not.toMatch(/\.unregister\(/);
  });
});
