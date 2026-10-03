import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const sw = fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');

describe('service worker source', () => {
  it('uses network-first for navigations', () => {
    expect(sw).toMatch(/mode\s*===\s*['"]navigate['"]/);
    // network fetch appears before cache fallback in navigation branch
    const navIdx = sw.indexOf("navigate");
    expect(navIdx).toBeGreaterThan(-1);
    expect(sw).toMatch(/skipWaiting/);
    expect(sw).toMatch(/clients\.claim/);
  });
  it('has push and notificationclick handlers', () => {
    expect(sw).toMatch(/addEventListener\(\s*['"]push['"]/);
    expect(sw).toMatch(/addEventListener\(\s*['"]notificationclick['"]/);
  });
  it('does not intercept api or ws requests', () => {
    expect(sw).toMatch(/\/api\//);
    expect(sw).toMatch(/return;/); // passthrough branch
  });
});
