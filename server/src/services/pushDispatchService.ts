import crypto from 'crypto';
import webpush from 'web-push';
import { getDb } from '../db/database';
import { getDayStatus } from './sleepService';
import { getFamilySubscriptions, removeSubscription } from './pushSubscriptionService';

export const NOTIFICATION_THROTTLE_MS = 15 * 60 * 1000;

export function nowInZone(tz: string, now: Date = new Date()): { date: string; time: string } {
  const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const fmtTime = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  return { date: fmtDate.format(now), time: fmtTime.format(now) };
}

export function shouldSend(familyId: string, key: string): boolean {
  const cutoffEpochSeconds = Math.floor((Date.now() - NOTIFICATION_THROTTLE_MS) / 1000);
  // sent_at is stored via SQLite's CURRENT_TIMESTAMP ("YYYY-MM-DD HH:MM:SS", UTC) by
  // default, but may also be an ISO string ("...T...Z") when inserted explicitly.
  // Plain string comparison between those two formats is unreliable (space vs 'T'
  // sorts incorrectly), so normalize both sides through strftime('%s', ...) to get
  // comparable Unix epoch seconds regardless of the stored format.
  const row = getDb().prepare(
    "SELECT 1 FROM push_dispatch_log WHERE family_id=? AND dispatch_key=? AND CAST(strftime('%s', sent_at) AS INTEGER) >= ? LIMIT 1"
  ).get(familyId, key, cutoffEpochSeconds);
  return !row;
}
function logSent(familyId: string, childId: string | null, key: string): void {
  getDb().prepare("INSERT INTO push_dispatch_log (id, family_id, child_id, dispatch_key, sent_at) VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))")
    .run(crypto.randomUUID(), familyId, childId, key);
}

type Sender = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<unknown>;
const defaultSender: Sender = (sub, payload) =>
  webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys } as any, payload);

function buildNotifications(status: any): Array<{ key: string; title: string; body: string }> {
  const out: Array<{ key: string; title: string; body: string }> = [];
  const s = status && status.schedule;
  if (!s) return out;
  if (s.state === 'AWAKE' && s.nextNap && s.nextNap.countdownMinutes <= 0) {
    out.push({ key: 'SLEEP_TIME', title: 'Пора спать малышу 😴', body: `Время бодрствования подошло к концу (${s.formattedAwakeDuration || ''}).` });
  }
  if (s.state === 'SLEEPING' && s.isWakeDeadlineExceeded) {
    out.push({ key: 'WAKE_NOW', title: 'Пора будить малыша ⏰', body: `Сон длится уже ${s.formattedSleepDuration || ''}.` });
  }
  const warnings = (s.warnings || status.warnings || []) as Array<any>;
  for (const w of warnings) {
    if (w.severity === 'alert' || w.severity === 'warning') {
      const key = w.code === 'ABNORMALLY_LONG_NAP' ? 'WAKE_NOW' : `WARNING_${w.code}`;
      out.push({ key, title: `⚠️ ${w.title}`, body: w.message });
    }
  }
  return out;
}

export async function dispatchAllFamilies(sender: Sender = defaultSender, now: Date = new Date()): Promise<{ sent: number; pruned: number }> {
  const db = getDb();
  let sent = 0, pruned = 0;
  const families = db.prepare('SELECT id, timezone FROM families').all() as Array<{ id: string; timezone: string }>;
  for (const fam of families) {
    const child = db.prepare('SELECT id FROM children WHERE family_id=? LIMIT 1').get(fam.id) as { id: string } | undefined;
    if (!child) continue;
    const tz = fam.timezone || 'Europe/Moscow';
    const { date, time } = nowInZone(tz, now);
    let status: any;
    try { status = getDayStatus(child.id, date, time); } catch { continue; }
    const notes = buildNotifications(status).filter((n) => shouldSend(fam.id, n.key));
    if (notes.length === 0) continue;
    const subs = getFamilySubscriptions(fam.id);
    for (const note of notes) {
      const payload = JSON.stringify({ title: note.title, body: note.body, tag: note.key, url: '/' });
      let delivered = false;
      for (const sub of subs) {
        try {
          await sender({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
          delivered = true; sent++;
        } catch (e: any) {
          if (e && (e.statusCode === 410 || e.statusCode === 404)) { removeSubscription(sub.endpoint); pruned++; }
        }
      }
      if (delivered) logSent(fam.id, child.id, note.key);
    }
  }
  return { sent, pruned };
}
