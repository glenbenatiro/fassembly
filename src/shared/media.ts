// Media containers the app accepts. Shared so the file dialog filter, the
// drag-and-drop handler, and the main-process job validator all agree.
export const MEDIA_EXTENSIONS = [
  'mp4',
  'm4v',
  'mov',
  'webm',
  'mkv',
  'avi',
  'mts',
  'm2ts',
  'mp3',
  'm4a',
  'wav',
  'aac',
  'flac',
  'ogg',
  'oga',
  'opus',
  'wma',
  'aiff',
];

const ALLOWED = new Set(MEDIA_EXTENSIONS);

export function isMediaPath(filePath: string): boolean {
  const dot = filePath.lastIndexOf('.');
  if (dot < 0) return false;
  return ALLOWED.has(filePath.slice(dot + 1).toLowerCase());
}
