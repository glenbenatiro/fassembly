// Return the folder that contains the given file path, handling both Windows
// "\" and POSIX "/" separators. Returns '' when there is no folder component.
export function parentDir(filePath: string): string {
  const i = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return i > 0 ? filePath.slice(0, i) : '';
}
