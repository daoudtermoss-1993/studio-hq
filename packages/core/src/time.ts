/** Timezone helpers without extra dependencies (Intl only). */

export function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${hour}:${get("minute")}`, weekday: get("weekday") };
}

/** Local calendar date (YYYY-MM-DD) in a timezone. */
export function localDate(timeZone: string, date = new Date()) {
  return zonedParts(date, timeZone).date;
}

/** Converts a wall-clock time in a timezone to a UTC Date. */
export function zonedToUtc(day: string, time: string, timeZone: string): Date {
  const guess = new Date(`${day}T${time}:00Z`);
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(guess, timeZone);
    const asUtc = new Date(`${p.date}T${p.time}:00Z`);
    const diff = new Date(`${day}T${time}:00Z`).getTime() - asUtc.getTime();
    if (diff === 0) break;
    guess.setTime(guess.getTime() + diff);
  }
  return guess;
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
