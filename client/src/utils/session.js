// Session state is the organising axis of the whole product, so the rules
// for reading it live in one place.

export const CODE_WINDOW_SECONDS = 600; // server rotates the code every 10 min

export function sessionState(session) {
  if (!session) return 'ended';
  const now = Date.now();
  const start = new Date(session.startTime).getTime();
  const end = new Date(session.endTime).getTime();
  if (now < start) return 'upcoming';
  if (now > end) return 'ended';
  return 'live';
}

export function isLive(session) {
  return sessionState(session) === 'live';
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDay(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatDayLong(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatStamp(date) {
  return `${formatDay(date)}, ${formatTime(date)}`;
}

export function formatWindow(session) {
  return `${formatDay(session.startTime)} · ${formatTime(
    session.startTime
  )} to ${formatTime(session.endTime)}`;
}

// "in 3 days" / "in 2 hours" — how far off an upcoming session is.
export function relativeToNow(date) {
  const diff = new Date(date).getTime() - Date.now();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'any moment';
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.round(hours / 24);
  return `in ${days} ${days === 1 ? 'day' : 'days'}`;
}

export function secondsUntil(date) {
  if (!date) return 0;
  return Math.max(0, Math.floor((new Date(date).getTime() - Date.now()) / 1000));
}

export function clock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
