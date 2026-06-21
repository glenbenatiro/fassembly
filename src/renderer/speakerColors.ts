// The "cast of voices": each speaker keeps a stable, warm ink color wherever
// their name appears (transcript, remap editor, review). Color is derived from
// the speaker key so the same speaker always reads the same across the app.

const CAST = [
  '#2F5D50', // pine
  '#9B4722', // claret
  '#3A4A7A', // ink-blue
  '#6D3B5E', // plum
  '#8A6D1F', // ochre
  '#1F6E6A', // teal
  '#A65A2A', // rust
  '#5A6B2E', // moss
] as const;

function hash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Stable ink color (hex) for a speaker key. */
export function speakerColor(key: string): string {
  return CAST[hash(key) % CAST.length];
}
