import crypto from 'crypto';
import { getDb, DbSleepEvent } from '../db/database';
import { getSettings } from './settingsService';
import {
  calculateDaySchedule,
  parseTimeToMinutes,
  formatMinutesToTime,
  formatMinutesToHoursAndMinutes,
  SleepEvent as EngineSleepEvent,
  ScheduleOutput,
} from '../../../shared/sleepEngine';

export interface FormattedSleepEvent {
  id: string;
  childId: string;
  date: string;
  eventType: 'WAKEUP' | 'NAP' | 'NIGHT_SLEEP';
  napNumber: number | null;
  startTime: string; // ISO
  endTime: string | null; // ISO
  formattedStartTime: string; // "HH:MM"
  formattedEndTime: string | null; // "HH:MM"
  durationMinutes: number | null;
  formattedDuration: string; // "1:15" or "1 ч 15 мин"
  recordedByUserId: string | null;
  recordedByName: string;
  source: string;
  isOngoing: boolean;
  title: string;
  subtitle: string;
}

export interface DayStatusResponse {
  date: string;
  currentTime: string;
  state: 'AWAKE' | 'SLEEPING';
  schedule: ScheduleOutput;
  events: FormattedSleepEvent[];
  child: {
    id: string;
    name: string;
    birthDate: string | null;
  };
  familyMembers: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

export interface RetroactiveEventInput {
  date: string;
  eventType: 'WAKEUP' | 'NAP' | 'NIGHT_SLEEP';
  startTime: string; // "HH:MM" or ISO
  endTime?: string | null; // "HH:MM" or ISO
  napNumber?: number | null;
  source?: string;
}

export interface UpdateSleepEventInput {
  eventType?: 'WAKEUP' | 'NAP' | 'NIGHT_SLEEP';
  startTime?: string;
  endTime?: string | null;
  napNumber?: number | null;
  date?: string;
}

export interface CalendarDaySummary {
  date: string;
  dayNumber: number;
  dayOfWeek: string;
  totalDaySleepMinutes: number;
  formattedTotalDaySleep: string;
  napsCount: number;
  targetNapsCount: number;
  bedtime: string | null;
  targetBedtime: string;
  wakeupTime: string | null;
  isNormMet: boolean;
  differenceFromNormMinutes: number;
  formattedDifference: string;
  events: FormattedSleepEvent[];
}

export interface MonthSummaryResponse {
  year: number;
  month: number;
  childId: string;
  targetDaySleepMinutes: number;
  targetNapsCount: number;
  targetBedtime: string;
  averageDaySleepMinutes: number;
  daysNormMetCount: number;
  totalLoggedDays: number;
  days: CalendarDaySummary[];
}

function normalizeToIso(dateStr: string, timeStr: string): string {
  if (timeStr.includes('T')) {
    const parts = timeStr.split('T');
    return `${dateStr}T${parts[1]}`;
  }
  const cleanTime = timeStr.trim();
  const parts = cleanTime.split(':');
  const hh = parts[0].padStart(2, '0');
  const mm = (parts[1] || '00').padStart(2, '0');
  const ss = (parts[2] || '00').padStart(2, '0');
  return `${dateStr}T${hh}:${mm}:${ss}`;
}

function formatEventForUi(e: DbSleepEvent): FormattedSleepEvent {
  const isOngoing = !e.end_time && (e.event_type === 'NAP' || e.event_type === 'NIGHT_SLEEP');
  const startMin = parseTimeToMinutes(e.start_time);
  const formattedStart = formatMinutesToTime(startMin);
  const formattedEnd = e.end_time ? formatMinutesToTime(parseTimeToMinutes(e.end_time)) : null;

  let durationMin = e.duration_minutes;
  if (durationMin == null && e.end_time) {
    const endMin = parseTimeToMinutes(e.end_time);
    let diff = endMin - startMin;
    if (diff < 0) diff += 1440;
    durationMin = diff;
  }

  let formattedDuration = '';
  if (durationMin != null && durationMin > 0) {
    formattedDuration = formatMinutesToHoursAndMinutes(durationMin);
  }

  let title = '';
  let subtitle = '';

  if (e.event_type === 'WAKEUP') {
    title = 'Подъём';
    subtitle = `${e.recorded_by_name} ${formattedStart}`;
  } else if (e.event_type === 'NAP') {
    title = `Сон ${e.nap_number ?? 1}`;
    if (isOngoing) {
      title += ' · идёт';
      subtitle = `${e.recorded_by_name} ${formattedStart} – …`;
    } else {
      if (formattedDuration) {
        title += ` · ${formattedDuration}`;
      }
      subtitle = `${e.recorded_by_name} ${formattedStart} – ${formattedEnd}`;
    }
  } else if (e.event_type === 'NIGHT_SLEEP') {
    title = 'Ночной сон';
    if (isOngoing) {
      title += ' · идёт';
      subtitle = `${e.recorded_by_name} ${formattedStart} – …`;
    } else {
      subtitle = `${e.recorded_by_name} ${formattedStart} – ${formattedEnd || '…'}`;
    }
  }

  return {
    id: e.id,
    childId: e.child_id,
    date: e.date,
    eventType: e.event_type,
    napNumber: e.nap_number,
    startTime: e.start_time,
    endTime: e.end_time,
    formattedStartTime: formattedStart,
    formattedEndTime: formattedEnd,
    durationMinutes: durationMin,
    formattedDuration,
    recordedByUserId: e.recorded_by_user_id,
    recordedByName: e.recorded_by_name,
    source: e.source,
    isOngoing,
    title,
    subtitle,
  };
}

export function getDayStatus(
  childId: string,
  dateStr?: string,
  currentTimeStr?: string
): DayStatusResponse {
  const db = getDb();
  const settingsData = getSettings(childId);
  const targetDate = dateStr || new Date().toISOString().slice(0, 10);
  const targetTime = currentTimeStr || formatMinutesToTime(
    targetDate === '2026-09-30' ? parseTimeToMinutes('13:05') : (new Date().getHours() * 60 + new Date().getMinutes())
  );

  // Fetch all events for targetDate
  const dbEvents = db.prepare(`
    SELECT * FROM sleep_events
    WHERE child_id = ? AND date = ?
    ORDER BY start_time ASC
  `).all(settingsData.child.id, targetDate) as DbSleepEvent[];

  // Also check if there is an active ongoing sleep across the DB
  const activeSleep = db.prepare(`
    SELECT * FROM sleep_events
    WHERE child_id = ? AND end_time IS NULL
    ORDER BY start_time DESC LIMIT 1
  `).get(settingsData.child.id) as DbSleepEvent | undefined;

  const eventIds = new Set(dbEvents.map(e => e.id));
  if (activeSleep && !eventIds.has(activeSleep.id)) {
    // If active sleep started earlier (e.g. yesterday or earlier today), include it
    dbEvents.push(activeSleep);
  }

  // Find morning wakeup time
  let morningWakeupTime = settingsData.settings.typicalWakeupTime;
  const wakeupEvent = dbEvents.find(e => e.event_type === 'WAKEUP');
  if (wakeupEvent) {
    morningWakeupTime = formatMinutesToTime(parseTimeToMinutes(wakeupEvent.start_time));
  } else {
    // Check previous day night sleep
    const prevDate = new Date(new Date(targetDate).getTime() - 86400000).toISOString().slice(0, 10);
    const prevNight = db.prepare(`
      SELECT * FROM sleep_events
      WHERE child_id = ? AND date = ? AND event_type = 'NIGHT_SLEEP'
      LIMIT 1
    `).get(settingsData.child.id, prevDate) as DbSleepEvent | undefined;

    if (prevNight && prevNight.end_time) {
      morningWakeupTime = formatMinutesToTime(parseTimeToMinutes(prevNight.end_time));
    }
  }

  // Convert to engine format
  const engineEvents: EngineSleepEvent[] = dbEvents.map(e => ({
    id: e.id,
    childId: e.child_id,
    eventType: e.event_type,
    startTime: e.start_time,
    endTime: e.end_time,
    durationMinutes: e.duration_minutes ?? undefined,
    napNumber: e.nap_number ?? undefined,
    source: e.source,
  }));

  const schedule = calculateDaySchedule({
    settings: {
      napsPerDay: settingsData.settings.napsPerDay,
      wakeIntervalMinMinutes: settingsData.settings.wakeIntervalMinMinutes,
      wakeIntervalMaxMinutes: settingsData.settings.wakeIntervalMaxMinutes,
      totalDaySleepMinutes: settingsData.settings.totalDaySleepMinutes,
      totalWakeMinutes: settingsData.settings.totalWakeMinutes,
      targetBedtime: settingsData.settings.targetBedtime,
      typicalWakeupTime: settingsData.settings.typicalWakeupTime,
    },
    currentTime: targetTime,
    events: engineEvents,
    morningWakeupTime,
  });

  const formattedEvents = dbEvents.map(formatEventForUi);

  return {
    date: targetDate,
    currentTime: targetTime,
    state: schedule.state,
    schedule,
    events: formattedEvents,
    child: {
      id: settingsData.child.id,
      name: settingsData.child.name,
      birthDate: settingsData.child.birthDate,
    },
    familyMembers: settingsData.family.members.map(m => ({
      id: m.id,
      name: m.name,
      role: m.role,
    })),
  };
}

export function recordFellAsleep(
  childId: string,
  userId: string,
  userName: string,
  time?: string,
  source: string = 'NOW',
  isNightSleep: boolean = false
): { event: FormattedSleepEvent; status: DayStatusResponse } {
  const db = getDb();
  const settingsData = getSettings(childId);

  // Check if baby is already sleeping
  const activeSleep = db.prepare(`
    SELECT * FROM sleep_events
    WHERE child_id = ? AND end_time IS NULL
    LIMIT 1
  `).get(settingsData.child.id) as DbSleepEvent | undefined;

  if (activeSleep) {
    throw new Error('Ребёнок уже спит');
  }

  const nowIso = new Date().toISOString();
  const effectiveTime = time ? (time.includes('T') ? time : normalizeToIso(nowIso.slice(0, 10), time)) : nowIso;
  const eventDate = effectiveTime.slice(0, 10);
  const timeFormatted = formatMinutesToTime(parseTimeToMinutes(effectiveTime));

  // Night sleep: event_type NIGHT_SLEEP, no nap number. Otherwise a numbered NAP.
  const eventType = isNightSleep ? 'NIGHT_SLEEP' : 'NAP';
  let napNumber: number | null = null;
  if (!isNightSleep) {
    const napCountRow = db.prepare(`
      SELECT COUNT(*) as count FROM sleep_events
      WHERE child_id = ? AND date = ? AND event_type = 'NAP'
    `).get(settingsData.child.id, eventDate) as { count: number };
    napNumber = napCountRow.count + 1;
  }

  const eventId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO sleep_events (
      id, child_id, date, event_type, nap_number, start_time, end_time,
      duration_minutes, recorded_by_user_id, recorded_by_name, source
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
  `).run(
    eventId,
    settingsData.child.id,
    eventDate,
    eventType,
    napNumber,
    effectiveTime,
    userId,
    userName,
    source
  );

  const rawEvent = db.prepare('SELECT * FROM sleep_events WHERE id = ?').get(eventId) as DbSleepEvent;
  const formatted = formatEventForUi(rawEvent);
  const status = getDayStatus(settingsData.child.id, eventDate, timeFormatted);

  return { event: formatted, status };
}

export function recordWokeUp(
  childId: string,
  userId: string,
  userName: string,
  time?: string,
  source: string = 'NOW'
): { event: FormattedSleepEvent; status: DayStatusResponse } {
  const db = getDb();
  const settingsData = getSettings(childId);

  const activeSleep = db.prepare(`
    SELECT * FROM sleep_events
    WHERE child_id = ? AND end_time IS NULL
    ORDER BY start_time DESC LIMIT 1
  `).get(settingsData.child.id) as DbSleepEvent | undefined;

  const nowIso = new Date().toISOString();
  const fallbackDate = activeSleep ? activeSleep.date : nowIso.slice(0, 10);
  const effectiveTime = time ? (time.includes('T') ? time : normalizeToIso(fallbackDate, time)) : nowIso;
  const timeFormatted = formatMinutesToTime(parseTimeToMinutes(effectiveTime));

  if (activeSleep) {
    const startMin = parseTimeToMinutes(activeSleep.start_time);
    const endMin = parseTimeToMinutes(effectiveTime);
    let durationMinutes = endMin - startMin;
    if (durationMinutes < 0) durationMinutes += 1440;

    db.prepare(`
      UPDATE sleep_events
      SET end_time = ?,
          duration_minutes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(effectiveTime, durationMinutes, activeSleep.id);

    const updatedRaw = db.prepare('SELECT * FROM sleep_events WHERE id = ?').get(activeSleep.id) as DbSleepEvent;
    const formatted = formatEventForUi(updatedRaw);
    const status = getDayStatus(settingsData.child.id, activeSleep.date, timeFormatted);

    return { event: formatted, status };
  }

  // If no active sleep, check if morning wakeup event exists today
  const existingWakeup = db.prepare(`
    SELECT * FROM sleep_events
    WHERE child_id = ? AND date = ? AND event_type = 'WAKEUP'
    LIMIT 1
  `).get(settingsData.child.id, fallbackDate) as DbSleepEvent | undefined;

  if (!existingWakeup) {
    const eventId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO sleep_events (
        id, child_id, date, event_type, nap_number, start_time, end_time,
        duration_minutes, recorded_by_user_id, recorded_by_name, source
      ) VALUES (?, ?, ?, 'WAKEUP', NULL, ?, ?, 0, ?, ?, ?)
    `).run(eventId, settingsData.child.id, fallbackDate, effectiveTime, effectiveTime, userId, userName, source);

    const rawEvent = db.prepare('SELECT * FROM sleep_events WHERE id = ?').get(eventId) as DbSleepEvent;
    const formatted = formatEventForUi(rawEvent);
    const status = getDayStatus(settingsData.child.id, fallbackDate, timeFormatted);

    return { event: formatted, status };
  }

  throw new Error('Нет активного сна для пробуждения');
}

export function recordRetroactive(
  childId: string,
  userId: string,
  userName: string,
  data: RetroactiveEventInput
): { event: FormattedSleepEvent; status: DayStatusResponse } {
  const db = getDb();
  const settingsData = getSettings(childId);

  const startIso = normalizeToIso(data.date, data.startTime);
  const endIso = data.endTime ? normalizeToIso(data.date, data.endTime) : null;

  let durationMinutes: number | null = null;
  if (endIso) {
    const startMin = parseTimeToMinutes(startIso);
    const endMin = parseTimeToMinutes(endIso);
    let diff = endMin - startMin;
    if (diff < 0) diff += 1440;
    durationMinutes = diff;
  }

  let napNumber = data.napNumber ?? null;
  if (data.eventType === 'NAP' && napNumber == null) {
    const countRow = db.prepare(`
      SELECT COUNT(*) as count FROM sleep_events
      WHERE child_id = ? AND date = ? AND event_type = 'NAP'
    `).get(settingsData.child.id, data.date) as { count: number };
    napNumber = countRow.count + 1;
  }

  const eventId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO sleep_events (
      id, child_id, date, event_type, nap_number, start_time, end_time,
      duration_minutes, recorded_by_user_id, recorded_by_name, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventId,
    settingsData.child.id,
    data.date,
    data.eventType,
    napNumber,
    startIso,
    endIso,
    durationMinutes,
    userId,
    userName,
    data.source || 'RETROACTIVE'
  );

  const raw = db.prepare('SELECT * FROM sleep_events WHERE id = ?').get(eventId) as DbSleepEvent;
  const formatted = formatEventForUi(raw);
  const status = getDayStatus(settingsData.child.id, data.date);

  return { event: formatted, status };
}

export function deleteSleepEvent(eventId: string, childId: string): { success: boolean; id: string } {
  const db = getDb();
  const res = db.prepare('DELETE FROM sleep_events WHERE id = ? AND child_id = ?').run(eventId, childId);
  if (res.changes === 0) {
    throw new Error('Запись о сне не найдена');
  }
  return { success: true, id: eventId };
}

export function updateSleepEvent(
  eventId: string,
  childId: string,
  input: UpdateSleepEventInput
): { event: FormattedSleepEvent; status: DayStatusResponse } {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sleep_events WHERE id = ? AND child_id = ?').get(eventId, childId) as DbSleepEvent | undefined;
  if (!existing) {
    throw new Error('Запись о сне не найдена');
  }

  const effectiveDate = input.date || existing.date;
  const effectiveType = input.eventType || existing.event_type;
  const effectiveStartIso = input.startTime ? normalizeToIso(effectiveDate, input.startTime) : (
    input.date && input.date !== existing.date ? normalizeToIso(effectiveDate, existing.start_time) : existing.start_time
  );

  let effectiveEndIso: string | null = existing.end_time;
  if (input.endTime !== undefined) {
    effectiveEndIso = input.endTime ? normalizeToIso(effectiveDate, input.endTime) : null;
  } else if (input.date && input.date !== existing.date && existing.end_time) {
    effectiveEndIso = normalizeToIso(effectiveDate, existing.end_time);
  }

  let durationMinutes: number | null = null;
  if (effectiveEndIso) {
    const startMin = parseTimeToMinutes(effectiveStartIso);
    const endMin = parseTimeToMinutes(effectiveEndIso);
    let diff = endMin - startMin;
    if (diff < 0) diff += 1440;
    durationMinutes = diff;
  }

  const napNumber = input.napNumber !== undefined ? input.napNumber : existing.nap_number;

  db.prepare(`
    UPDATE sleep_events
    SET date = ?,
        event_type = ?,
        start_time = ?,
        end_time = ?,
        duration_minutes = ?,
        nap_number = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND child_id = ?
  `).run(effectiveDate, effectiveType, effectiveStartIso, effectiveEndIso, durationMinutes, napNumber, eventId, childId);

  const updatedRaw = db.prepare('SELECT * FROM sleep_events WHERE id = ?').get(eventId) as DbSleepEvent;
  const formatted = formatEventForUi(updatedRaw);
  const status = getDayStatus(childId, effectiveDate);

  return { event: formatted, status };
}

export function getMonthSummary(childId: string, year: number, month: number): MonthSummaryResponse {
  const db = getDb();
  const settingsData = getSettings(childId);

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month, 0).getDate();

  const events = db.prepare(`
    SELECT * FROM sleep_events
    WHERE child_id = ? AND date LIKE ?
    ORDER BY start_time ASC
  `).all(settingsData.child.id, `${monthPrefix}%`) as DbSleepEvent[];

  const eventsByDate = new Map<string, DbSleepEvent[]>();
  for (const ev of events) {
    const arr = eventsByDate.get(ev.date) || [];
    arr.push(ev);
    eventsByDate.set(ev.date, arr);
  }

  const daysSummary: CalendarDaySummary[] = [];
  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  let totalSleepAllDays = 0;
  let loggedDaysCount = 0;
  let daysNormMetCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, '0');
    const fullDate = `${monthPrefix}-${dayStr}`;
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dayNames[dateObj.getDay()];

    const dayEvents = eventsByDate.get(fullDate) || [];
    const completedNaps = dayEvents.filter(e => e.event_type === 'NAP' && e.end_time != null);
    const totalDaySleep = completedNaps.reduce((acc, cur) => acc + (cur.duration_minutes || 0), 0);
    const napsCount = completedNaps.length;

    const wakeupEvent = dayEvents.find(e => e.event_type === 'WAKEUP');
    const nightSleepEvent = dayEvents.find(e => e.event_type === 'NIGHT_SLEEP');

    const bedtime = nightSleepEvent ? formatMinutesToTime(parseTimeToMinutes(nightSleepEvent.start_time)) : null;
    const wakeupTime = wakeupEvent ? formatMinutesToTime(parseTimeToMinutes(wakeupEvent.start_time)) : null;

    const diffFromNorm = totalDaySleep - settingsData.settings.totalDaySleepMinutes;
    // Norm considered met if within 15 minutes of target or higher, when day has completed naps
    const isNormMet = totalDaySleep >= (settingsData.settings.totalDaySleepMinutes - 15);

    let formattedDiff = '';
    if (diffFromNorm === 0) {
      formattedDiff = 'норма';
    } else if (diffFromNorm > 0) {
      formattedDiff = `+${diffFromNorm} мин`;
    } else {
      formattedDiff = `${diffFromNorm} мин`;
    }

    if (dayEvents.length > 0) {
      loggedDaysCount++;
      totalSleepAllDays += totalDaySleep;
      if (isNormMet) {
        daysNormMetCount++;
      }
    }

    daysSummary.push({
      date: fullDate,
      dayNumber: d,
      dayOfWeek,
      totalDaySleepMinutes: totalDaySleep,
      formattedTotalDaySleep: formatMinutesToHoursAndMinutes(totalDaySleep),
      napsCount,
      targetNapsCount: settingsData.settings.napsPerDay,
      bedtime,
      targetBedtime: settingsData.settings.targetBedtime,
      wakeupTime,
      isNormMet,
      differenceFromNormMinutes: diffFromNorm,
      formattedDifference: formattedDiff,
      events: dayEvents.map(formatEventForUi),
    });
  }

  const averageDaySleepMinutes = loggedDaysCount > 0 ? Math.round(totalSleepAllDays / loggedDaysCount) : 0;

  return {
    year,
    month,
    childId: settingsData.child.id,
    targetDaySleepMinutes: settingsData.settings.totalDaySleepMinutes,
    targetNapsCount: settingsData.settings.napsPerDay,
    targetBedtime: settingsData.settings.targetBedtime,
    averageDaySleepMinutes,
    daysNormMetCount,
    totalLoggedDays: loggedDaysCount,
    days: daysSummary,
  };
}
