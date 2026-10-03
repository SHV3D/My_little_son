import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../index';
import { initDatabase, setDb } from '../db/database';
import Database from 'better-sqlite3';

// index.ts resolves clientDistPath relative to its own __dirname (server/src),
// which in this repo lands on <repo>/client/dist. This test file lives in
// server/src/tests, so the SAME real directory is ../../../client/dist from
// here. We target that exact dir so the fixture lands where the running app
// will look for it (replicating index.ts's candidate list here is fragile
// because __dirname differs between index.ts and the test).
const clientDistPath = path.resolve(__dirname, '../../../client/dist');
const swPath = path.join(clientDistPath, 'sw.js');

describe('service worker serving', () => {
  let db: Database.Database;
  // Guard: only clean up the fixture if THIS test created it. A later build task
  // may legitimately produce a real sw.js that we must never delete.
  let fixtureCreated = false;

  beforeAll(() => {
    db = initDatabase(':memory:');
    setDb(db);
    if (!fs.existsSync(swPath)) {
      fs.mkdirSync(clientDistPath, { recursive: true });
      fs.writeFileSync(swPath, "self.addEventListener('install', () => {});\n");
      fixtureCreated = true;
    }
  });

  afterAll(() => {
    if (fixtureCreated && fs.existsSync(swPath)) {
      fs.unlinkSync(swPath);
    }
    if (db) db.close();
  });

  it('serves sw.js as javascript with no-cache headers (200 branch)', async () => {
    const res = await request(app).get('/sw.js').set('Host', 'localhost:3001');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('javascript');
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.headers['service-worker-allowed']).toBe('/');
  });

  it('also serves /service-worker.js alias from the same handler (200 branch)', async () => {
    const res = await request(app)
      .get('/service-worker.js')
      .set('Host', 'localhost:3001');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('javascript');
    expect(res.headers['service-worker-allowed']).toBe('/');
  });

  it('returns 404 with no-cache when sw.js is absent (404 branch)', async () => {
    // Only exercise this destructive branch when WE own the fixture. If a real
    // sw.js pre-existed (a later build task may produce one), never touch it —
    // skip rather than risk deleting a file we do not own.
    if (!fixtureCreated) {
      return;
    }
    fs.unlinkSync(swPath);
    try {
      const res = await request(app).get('/sw.js').set('Host', 'localhost:3001');
      expect(res.status).toBe(404);
      expect(res.headers['cache-control']).toBe('no-cache');
    } finally {
      // Restore our fixture so the other tests (and afterAll cleanup) stay valid.
      fs.writeFileSync(swPath, "self.addEventListener('install', () => {});\n");
    }
  });
});
