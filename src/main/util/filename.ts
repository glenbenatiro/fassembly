import path from 'node:path';

export const DEFAULT_FILENAME_PATTERN = '{date}-{name}.md';

function sanitise(part: string): string {
  return part.replace(/[<>:"/\\|?*]/g, '-').trim();
}

/**
 * Resolve a filename pattern. Tokens: {date}, {name} (the recording's basename).
 *
 * {name} matters for batches. With the old {date}-meeting.md default, every file
 * in a ten-file batch resolved to the same name, so nine of them ended up as
 * "-2 ... -10" and you could not tell which transcript came from which recording.
 * A stored pattern that predates {name} gets it appended rather than rewritten,
 * so an existing preference is honoured without producing collisions.
 */
export function buildFilename(pattern: string, isoDate: string, sourceFileName: string): string {
  const raw = pattern && pattern.trim() ? pattern.trim() : DEFAULT_FILENAME_PATTERN;
  // Drop any legacy {job} token, along with a trailing separator.
  const cleaned = raw.replace(/\{job\}-?/g, '');

  const ext = path.extname(cleaned) || '.md';
  let stem = cleaned.slice(0, cleaned.length - ext.length);
  if (!stem.includes('{name}')) stem = `${stem}-{name}`;

  const name = sanitise(path.basename(sourceFileName, path.extname(sourceFileName)));
  const resolved = stem
    .replace(/\{date\}/g, sanitise(isoDate))
    .replace(/\{name\}/g, name || 'transcript');

  return `${sanitise(resolved).replace(/^-+|-+$/g, '') || 'transcript'}${ext}`;
}
