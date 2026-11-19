// Dates and times as the API sends them: office-local "YYYY-MM-DD" days and "HH:mm:ss" times, plus
// UTC instants ("2026-11-12T03:30:00Z") for bookedAt and checkedInAt. The browser's own time zone is
// never used: "today" and "now" are always worked out in the office's zone with Intl.

/** "2026-11-12" today in the given IANA zone. */
export function todayIn(timeZone) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Minutes since midnight right now in the given zone (for greying out times that have started). */
export function nowMinutesIn(timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === 'hour').value);
  const minute = Number(parts.find((part) => part.type === 'minute').value);
  return hour * 60 + minute;
}

/** "09:30:00" or "09:30" -> 570 */
export function toMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** 570 -> "09:30" (the format the API takes) */
export function fromMinutes(total) {
  const hours = String(Math.floor(total / 60)).padStart(2, '0');
  const minutes = String(total % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** "09:30:00" -> "09:30" */
export function hhmm(time) {
  return time ? time.slice(0, 5) : time;
}

function parts12(time) {
  const total = toMinutes(time);
  const hours = Math.floor(total / 60) % 24;
  const minutes = String(total % 60).padStart(2, '0');
  const period = hours < 12 ? 'am' : 'pm';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return { text: `${hour12}:${minutes}`, period };
}

/** "13:00:00" -> "1:00 pm" */
export function formatTime(time) {
  const { text, period } = parts12(time);
  return `${text} ${period}`;
}

/** "9:00 am – 5:00 pm", or "1:00 – 5:00 pm" when both are in the same half of the day. */
export function formatRange(from, to) {
  const start = parts12(from);
  const end = parts12(to);
  if (start.period === end.period) {
    return `${start.text} – ${end.text} ${end.period}`;
  }
  return `${start.text} ${start.period} – ${end.text} ${end.period}`;
}

/** The hour labels on the room day bar: "8 am", "9", ..., "12 pm", "1", ... */
export function hourLabel(hour, first) {
  if (first || hour === 12) {
    return `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? 'am' : 'pm'}`;
  }
  return String(hour % 12 === 0 ? 12 : hour % 12);
}

// A "YYYY-MM-DD" day is read as midnight UTC and formatted in UTC, so it never shifts a day.
function asUtcDate(day) {
  return new Date(`${day}T00:00:00Z`);
}

/** "2026-11-13" -> "Fri 13 Nov" (or "Fri 13 Nov 2026" with { year: true }) */
export function formatDay(day, { year = false } = {}) {
  const options = { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' };
  if (year) {
    options.year = 'numeric';
  }
  return new Intl.DateTimeFormat('en-GB', options).format(asUtcDate(day)).replace(',', '');
}

/** "2026-11-13" -> "Fri" */
export function weekdayShort(day) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' }).format(asUtcDate(day));
}

/** An instant shown in the office's zone: "Mon 19 Oct, 10:12 am". */
export function formatInstant(instant, timeZone) {
  const date = new Date(instant);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' })
    .format(date)
    .replace(',', '');
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true })
    .format(date)
    .replace(/\s/g, ' ')
    .toLowerCase();
  return `${day}, ${time}`;
}

/** Only the day of an instant in the office's zone: "Mon 26 Oct". */
export function formatInstantDay(instant, timeZone) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(instant))
    .replace(',', '');
}

/** Only the time of an instant in the office's zone: "8:58 am". */
export function formatInstantTime(instant, timeZone) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(instant))
    .replace(/\s/g, ' ')
    .toLowerCase();
}

/** "2026-11-12" plus n days. */
export function addDays(day, count) {
  const date = asUtcDate(day);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

/** The Monday of the week that holds the day. */
export function mondayOf(day) {
  const weekday = (asUtcDate(day).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -weekday);
}

/** The calendar for a month: { year, month (0-11), cells: ['YYYY-MM-DD' | null, ...] } starting on Monday. */
export function monthGrid(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10));
  }
  return cells;
}

export function monthTitle(year, month) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })
    .format(new Date(Date.UTC(year, month, 1)));
}

/** A friendly zone label for pickers: "IST (Asia/Kolkata)". */
export function zoneLabel(timeZone, shortName) {
  return shortName ? `${shortName} (${timeZone})` : timeZone;
}

/** The short name of a zone right now, for example "IST" or "GMT". */
export function zoneShortName(timeZone) {
  try {
    const part = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((entry) => entry.type === 'timeZoneName');
    return part ? part.value : timeZone;
  } catch {
    return timeZone;
  }
}

/** Every IANA zone the browser knows, for the New office form. */
// Chrome (and Node) build their zone list from ICU, which still uses some old IANA names, for example
// Asia/Calcutta instead of Asia/Kolkata. The list shows the current names, so "Asia/Kolkata" can be picked
// and the form's default is always one of the options. The backend knows both kinds of name.
const CURRENT_ZONE_NAMES = {
  'Africa/Asmera': 'Africa/Asmara',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'America/Catamarca': 'America/Argentina/Catamarca',
  'America/Cordoba': 'America/Argentina/Cordoba',
  'America/Godthab': 'America/Nuuk',
  'America/Indianapolis': 'America/Indiana/Indianapolis',
  'America/Jujuy': 'America/Argentina/Jujuy',
  'America/Louisville': 'America/Kentucky/Louisville',
  'America/Mendoza': 'America/Argentina/Mendoza',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Europe/Kiev': 'Europe/Kyiv',
  'Pacific/Enderbury': 'Pacific/Kanton',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Pacific/Truk': 'Pacific/Chuuk',
};

/** The current IANA name of a zone ("Asia/Calcutta" -> "Asia/Kolkata"). */
export function currentZoneName(zone) {
  return CURRENT_ZONE_NAMES[zone] ?? zone;
}

export function allTimeZones() {
  let zones;
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = ['Asia/Kolkata', 'Europe/London'];
  }
  return [...new Set([...zones.map(currentZoneName), 'UTC'])].sort();
}

/** 30-minute steps between two times, as "HH:mm" strings. */
export function halfHourSteps(fromTime, toTime) {
  const steps = [];
  for (let minute = toMinutes(fromTime); minute <= toMinutes(toTime); minute += 30) {
    steps.push(fromMinutes(minute));
  }
  return steps;
}
