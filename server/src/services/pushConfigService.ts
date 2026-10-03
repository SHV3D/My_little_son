import crypto from 'crypto';
import webpush from 'web-push';
import { getDb } from '../db/database';

function getConfig(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM app_config WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}
function setConfig(key: string, value: string): void {
  getDb().prepare('INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP').run(key, value);
}

export function getOrCreateVapidKeys(): { publicKey: string; privateKey: string } {
  let pub = getConfig('vapid_public_key');
  let priv = getConfig('vapid_private_key');
  if (!pub || !priv) {
    const keys = webpush.generateVAPIDKeys();
    pub = keys.publicKey; priv = keys.privateKey;
    setConfig('vapid_public_key', pub);
    setConfig('vapid_private_key', priv);
  }
  return { publicKey: pub, privateKey: priv };
}

export function getCronKey(): string {
  if (process.env.PUSH_CRON_KEY) return process.env.PUSH_CRON_KEY;
  let key = getConfig('push_cron_key');
  if (!key) { key = crypto.randomUUID(); setConfig('push_cron_key', key); }
  return key;
}

export function configureWebPush(): void {
  const { publicKey, privateKey } = getOrCreateVapidKeys();
  webpush.setVapidDetails('mailto:admin@shved.su', publicKey, privateKey);
}
