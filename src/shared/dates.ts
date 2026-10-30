// The local calendar date as yyyy-mm-dd. Local rather than UTC on purpose: a
// meeting at 7am in UTC+8 happened "today", not on the previous UTC day.
export function todayIso(now: Date = new Date()): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
