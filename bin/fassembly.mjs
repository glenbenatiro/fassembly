#!/usr/bin/env node
// The `fassembly` command. `npm link` puts it on PATH; see README > Command line.
//
// The work happens inside the packaged app, not here: only the app can read the
// API key it encrypted (Electron safeStorage), and its fuses deliberately stop it
// being run as plain Node. So this script finds that build, starts it with the
// user's arguments, and waits for it. Fassembly.exe is a GUI program, which a
// terminal would not otherwise wait for or take an exit code from.

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Through `npm link` this file is reached via a symlink, so resolve the real
// checkout before looking for its build.
const root = path.dirname(path.dirname(fs.realpathSync(fileURLToPath(import.meta.url))));
const inWsl = process.platform === 'linux' && !!process.env.WSL_DISTRO_NAME;

if (process.platform !== 'win32' && !inWsl) {
  fail('this command needs Windows, or WSL on Windows: only the Windows app is built.');
}

const exe = path.join(root, 'out', `Fassembly-win32-${process.arch}`, 'Fassembly.exe');
if (!fs.existsSync(exe)) {
  fail(`the app has not been built yet. Run "npm run package" in ${root}, then try again.`);
}

// From WSL the app still runs on Windows, through WSL interop, and Windows cannot
// read "/mnt/e/..." paths. Translate any absolute POSIX path the user passed.
const userArgs = process.argv.slice(2);
const args = inWsl ? userArgs.map(toWindowsArg) : userArgs;

// `--` stops Chromium from reading the user's flags as its own switches.
const child = spawn(exe, ['--cli', '--', ...args], { stdio: ['inherit', 'pipe', 'inherit'] });

child.on('error', (err) => fail(`could not start ${exe}: ${err.message}`));
// 'close' rather than 'exit', so all of stdout is through before we finish.
child.on('close', (code) => {
  process.exitCode = code ?? 1;
});

// The Electron runtime writes one line break to stdout as it starts, in every
// mode and before any app code runs. Drop it, so that stdout carries only the
// results and `$paths = fassembly ...` gets no empty first line.
let head = Buffer.alloc(0);
let headDone = false;
child.stdout.on('data', (chunk) => {
  if (headDone) return void process.stdout.write(chunk);
  head = Buffer.concat([head, chunk]);
  if (head.length === 1 && head[0] === 0x0d) return; // wait for the \n
  headDone = true;
  const skip = head[0] === 0x0a ? 1 : head[0] === 0x0d && head[1] === 0x0a ? 2 : 0;
  process.stdout.write(head.subarray(skip));
});
child.stdout.on('end', () => {
  if (!headDone) process.stdout.write(head);
});

// When Ctrl+C reaches the app too, it stops cleanly and reports what it had
// already submitted. Give it a moment to do that before forcing it; a second
// Ctrl+C forces it at once.
let interrupted = false;
process.on('SIGINT', () => {
  if (interrupted) return stop();
  interrupted = true;
  setTimeout(stop, 5_000).unref();
});
process.on('SIGTERM', stop);

function stop() {
  process.stderr.write('Stopped. AssemblyAI may still finish and bill anything already submitted.\n');
  child.kill();
}

function toWindowsArg(arg) {
  const inline = /^(--[a-z-]+=)(\/.*)$/.exec(arg);
  if (inline) return inline[1] + toWindowsPath(inline[2]);
  return arg.startsWith('/') ? toWindowsPath(arg) : arg;
}

function toWindowsPath(posixPath) {
  try {
    return execFileSync('wslpath', ['-w', posixPath], { encoding: 'utf8' }).trim();
  } catch {
    // wslpath refuses some paths that do not exist yet. Pass it through and let
    // the app report it the same way it reports any other missing file.
    return posixPath;
  }
}

function fail(message) {
  process.stderr.write(`fassembly: ${message}\n`);
  process.exit(2);
}
