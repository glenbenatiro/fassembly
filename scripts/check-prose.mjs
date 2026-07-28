/**
 * Fails if a literal em dash appears anywhere in the tracked source.
 *
 * The rule is in the README: use a spaced hyphen instead. The one legitimate
 * use, the separator class in src/main/stt/identify.ts, is written as the
 * escape \u2014 and so never appears here as a literal.
 */
import fs from 'node:fs';
import path from 'node:path';

const EM = String.fromCharCode(0x2014);
const EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.jsx', '.css', '.md', '.json', '.yml', '.yaml', '.html']);
const SKIP = new Set(['node_modules', '.git', 'out', '.vite', '.test-build', 'package-lock.json']);

const offenders = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!EXT.has(path.extname(e.name))) continue;
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (line.includes(EM)) offenders.push(`${path.relative(process.cwd(), p)}:${i + 1}: ${line.trim()}`);
    });
  }
}
walk(process.cwd());

if (offenders.length) {
  console.error('Literal em dashes found. Use a spaced hyphen " - " instead:\n');
  for (const o of offenders) console.error('  ' + o);
  process.exit(1);
}
console.log('prose: no literal em dashes');
