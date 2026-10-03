import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const sw = fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');

// Fetch handler body: from the fetch addEventListener up to (but not including)
// the push handler. Positional assertions below run against this slice so that
// order/placement — not mere presence anywhere in the file — is what is pinned.
const fetchStart = sw.indexOf("addEventListener('fetch'");
const pushStart = sw.indexOf("addEventListener('push'");
const fetchBody = fetchStart > -1 ? sw.slice(fetchStart, pushStart > -1 ? pushStart : undefined) : '';

describe('service worker source', () => {
  it('uses network-first for navigations', () => {
    expect(sw).toMatch(/mode\s*===\s*['"]navigate['"]/);
    // network fetch appears before cache fallback in navigation branch
    const navIdx = sw.indexOf("navigate");
    expect(navIdx).toBeGreaterThan(-1);
    expect(sw).toMatch(/skipWaiting/);
    expect(sw).toMatch(/clients\.claim/);

    // Network-first (root-cause fix for the white-screen): inside the navigate
    // branch the network fetch MUST precede any cache read. Slice the branch
    // from `mode === 'navigate'` to the stale-while-revalidate asset comment and
    // assert fetch(req) comes before caches / cache.match (index comparison).
    const navBranchStart = fetchBody.search(/mode\s*===\s*['"]navigate['"]/);
    expect(navBranchStart).toBeGreaterThan(-1);
    const assetMarker = fetchBody.indexOf('stale-while-revalidate');
    const navBranch = fetchBody.slice(navBranchStart, assetMarker > -1 ? assetMarker : undefined);
    const fetchIdx = navBranch.indexOf('fetch(req)');
    const cacheIdx = navBranch.search(/caches\.open|cache\.match/);
    expect(fetchIdx).toBeGreaterThan(-1);
    expect(cacheIdx).toBeGreaterThan(-1);
    // fetch BEFORE cache => network-first, not cache-first.
    expect(fetchIdx).toBeLessThan(cacheIdx);
  });
  it('has push and notificationclick handlers', () => {
    expect(sw).toMatch(/addEventListener\(\s*['"]push['"]/);
    expect(sw).toMatch(/addEventListener\(\s*['"]notificationclick['"]/);
  });
  it('does not intercept api or ws requests', () => {
    expect(sw).toMatch(/\/api\//);
    expect(sw).toMatch(/return;/); // passthrough branch

    // The passthrough guard must live inside the fetch handler, bind /api/ (and
    // /ws + origin) to a `return;`, and that return must come BEFORE any
    // respondWith — otherwise api/ws/cross-origin requests would be intercepted.
    expect(fetchStart).toBeGreaterThan(-1);
    // /api/ check is directly bound to its passthrough `return;` (not two
    // unrelated matches floating anywhere in the file).
    expect(fetchBody).toMatch(/\/api\/[\s\S]{0,160}return;/);
    // /ws passthrough and cross-origin guard are present in the same guard.
    expect(fetchBody).toMatch(/\/ws/);
    expect(fetchBody).toMatch(/url\.origin\s*!==\s*self\.location\.origin/);

    // Positional: the passthrough `return;` precedes the first respondWith, so
    // api/ws/cross-origin bail out before any interception.
    const apiIdx = fetchBody.indexOf('/api/');
    const passthroughReturnIdx = fetchBody.indexOf('return;', apiIdx);
    const firstRespondWith = fetchBody.indexOf('respondWith');
    expect(apiIdx).toBeGreaterThan(-1);
    expect(passthroughReturnIdx).toBeGreaterThan(-1);
    expect(firstRespondWith).toBeGreaterThan(-1);
    expect(passthroughReturnIdx).toBeLessThan(firstRespondWith);
  });
});
