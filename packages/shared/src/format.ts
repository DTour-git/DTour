// Formatting helpers shared by web and mobile. All dates are shown in IST.

const TZ = 'Asia/Kolkata';
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

/** "2h", "52m", "3d" — compact age used in meta rows. */
export function ago(iso: string | Date, now = Date.now()): string {
  const d = now - new Date(iso).getTime();
  if (d < MIN) return 'now';
  if (d < HOUR) return `${Math.floor(d / MIN)}m`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h`;
  if (d < 7 * DAY) return `${Math.floor(d / DAY)}d`;
  return shortDate(iso);
}

/** "4 min ago", "1 hr ago", "2 hours ago", "Yesterday", "3 days ago". */
export function agoLong(iso: string | Date, now = Date.now()): string {
  const d = now - new Date(iso).getTime();
  if (d < MIN) return 'just now';
  if (d < HOUR) return `${Math.floor(d / MIN)} min ago`;
  if (d < 2 * HOUR) return '1 hr ago';
  if (d < DAY) return `${Math.floor(d / HOUR)} hours ago`;
  if (d < 2 * DAY) return 'Yesterday';
  if (d < 7 * DAY) return `${Math.floor(d / DAY)} days ago`;
  if (d < 14 * DAY) return '1 week ago';
  if (d < 30 * DAY) return `${Math.floor(d / (7 * DAY))} weeks ago`;
  return shortDate(iso);
}

function parts(date: Date) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(date);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? '';
  return {
    weekday: get('weekday'), day: get('day'), month: get('month'), year: get('year'),
    hour: get('hour'), minute: get('minute'), period: get('dayPeriod').toLowerCase(),
  };
}

export function shortDate(iso: string | Date): string {
  const p = parts(new Date(iso));
  return `${p.day} ${p.month.slice(0, 3)}`;
}

/** "2:05 pm", or "7 pm" on the hour. */
export function clock(iso: string | Date, dropZeroMinutes = true): string {
  const p = parts(new Date(iso));
  if (dropZeroMinutes && p.minute === '00') return `${p.hour} ${p.period}`;
  return `${p.hour}:${p.minute} ${p.period}`;
}

/** "8:02", "10:15", "7 pm", "12 am" — the Today timeline's time column. */
export function timelineTime(iso: string | Date): string {
  const p = parts(new Date(iso));
  if (p.minute === '00') return `${p.hour} ${p.period}`;
  return `${p.hour}:${p.minute}`;
}

/** Lounge message time "4:12". */
export function chatTime(iso: string | Date): string {
  const p = parts(new Date(iso));
  return `${p.hour}:${p.minute}`;
}

/** "Saturday, 17 October 2026" */
export function longDate(date = new Date()): string {
  const p = parts(date);
  return `${p.weekday}, ${p.day} ${p.month} ${p.year}`;
}

/** "Sat, 17 Oct" */
export function mobileDate(date = new Date()): string {
  const p = parts(date);
  return `${p.weekday.slice(0, 3)}, ${p.day} ${p.month.slice(0, 3)}`;
}

export function dayOfMonth(date = new Date()): string {
  return parts(date).day;
}
export function weekdayShort(date = new Date()): string {
  return parts(date).weekday.slice(0, 3);
}
export function monthShort(iso: string | Date): string {
  return parts(new Date(iso)).month.slice(0, 3).toUpperCase();
}
export function weekdayCaps(iso: string | Date): string {
  return parts(new Date(iso)).weekday.slice(0, 3).toUpperCase();
}
export function dayNum(iso: string | Date): string {
  return parts(new Date(iso)).day.padStart(2, '0');
}

/** Calendar date (YYYY-MM-DD) in IST. */
export function istDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
}

export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  return Math.round((Date.parse(toIsoDate) - Date.parse(fromIsoDate)) / DAY);
}

/** Days from today (IST) until a YYYY-MM-DD date. */
export function daysUntil(isoDate: string, now = new Date()): number {
  return daysBetween(istDate(now), isoDate);
}

/** "Vol. 1 · No. 214" */
export function dateline(launchDate: string, now = new Date()): { vol: number; no: number } {
  const days = daysBetween(launchDate, istDate(now));
  return { vol: Math.floor(days / 365) + 1, no: days + 1 };
}

export function weekOfSem(semStart: string, now = new Date()): number {
  return Math.max(1, Math.floor(daysBetween(semStart, istDate(now)) / 7) + 1);
}

/** 1240 → "1,240" */
export function n(v: number | null | undefined): string {
  return new Intl.NumberFormat('en-US').format(v ?? 0);
}

/** 31200 → "31.2k", 1800 → "1.8k", 940 → "940", 196000 → "196k" */
export function compact(v: number | null | undefined): string {
  const x = v ?? 0;
  if (x < 1000) return String(x);
  const k = x / 1000;
  if (k >= 100) return `${Math.round(k)}k`;
  return `${k.toFixed(1).replace(/\.0$/, '')}k`;
}

export function fileSize(bytes: number | null | undefined): string {
  const b = bytes ?? 0;
  if (b <= 0) return '';
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/** Flair tag "COE '28" */
export function flair(branch: string | null | undefined, gradYear: number | null | undefined): string | null {
  if (!branch || !gradYear) return null;
  return `${branch} '${String(gradYear).slice(-2)}`;
}

export function yearLabel(semester: number | null | undefined): string | null {
  if (!semester) return null;
  const y = Math.ceil(semester / 2);
  return `${y}${['th', 'st', 'nd', 'rd'][y] ?? 'th'} year`;
}

export function ordinalSem(semester: number): string {
  return `${semester}${['th', 'st', 'nd', 'rd'][semester] ?? 'th'}`;
}

/** "AK" from "aarav.k", "SS" from "segfault_sneha", "H6" from "hostel_h6". */
export function initials(handleOrName: string): string {
  const parts = handleOrName.replace(/^@/, '').split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return handleOrName.replace(/^@/, '').slice(0, 2).toUpperCase();
}

/** Team deadline: "3 days left", "1 week left", or a custom label. */
export function deadlineText(deadlineOn: string | null, label: string | null, now = new Date()): string {
  if (label) return label;
  if (!deadlineOn) return 'Rolling';
  const d = daysUntil(deadlineOn, now);
  if (d < 0) return 'Closed';
  if (d === 0) return 'Closes today';
  if (d === 1) return '1 day left';
  if (d < 7) return `${d} days left`;
  if (d < 14) return '1 week left';
  return `${Math.floor(d / 7)} weeks left`;
}

/** Society-post kicker kind label. */
export const POST_KIND_LABEL: Record<string, string> = {
  event: 'Event', recruiting: 'Recruiting', workshop: 'Workshop', talk: 'Talk',
};
export function postKindTone(kind: string): 'accent' | 'accent2' {
  return kind === 'event' || kind === 'recruiting' ? 'accent2' : 'accent';
}
