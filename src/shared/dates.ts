// The local calendar date as yyyy-mm-dd. Local rather than UTC on purpose: a
// meeting at 7am in UTC+8 happened "today", not on the previous UTC day.
export function todayIso(now: Date = new Date()): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// A yyyy-mm-dd date in a file name, separated by -, _ or ., and not part of a
// longer run of digits. Covers "Screen Recording 2026-11-09 184950.mp4" (the
// Windows Snipping Tool) and "Meeting started 2026_10_03 18_02" (Google Meet).
const NAME_DATE = /(?<!\d)(\d{4})[-_.](\d{2})[-_.](\d{2})(?!\d)/;

/** The first real calendar date in a file name, or null when there is none. */
export function dateFromFileName(fileName: string): string | null {
  const match = NAME_DATE.exec(fileName);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  // Date rolls 2026-02-30 over to March, so a round trip rejects impossible dates.
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return null;
  }
  return `${y}-${m}-${d}`;
}

/**
 * The day a recording was made: the date in its file name when it has one, else
 * the local date it was last modified, which for a recording is when it ended.
 * Transcribing a call the next day must not date the transcript the next day.
 */
export function recordingDateIso(fileName: string, modified: Date): string {
  return dateFromFileName(fileName) ?? todayIso(modified);
}
