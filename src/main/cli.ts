import { app } from 'electron';
import path from 'node:path';
import type { JobRecord, JobSpec } from '../shared/types';
import { todayIso } from '../shared/dates';
import { HELP_TEXT, parseCliArgs, UsageError, type CliSource } from '../cli/args';
import { buildSpecs } from '../cli/specs';
import { defaultLatestDir, newestRecording } from '../cli/latest';
import { exitCodeFor, ProgressPrinter, toCliResult, warningLines } from '../cli/report';
import type { JobQueue } from './jobs/queue';
import { isTerminal } from './jobs/state';
import { MAX_BATCH, validateJobSpec } from './jobs/validate';
import { getApiKey, getSettings } from './settings';

const EXIT_USAGE = 2;

const out = (line: string) => process.stdout.write(`${line}\n`);
const err = (line: string) => process.stderr.write(`${line}\n`);

/**
 * One headless run: parse, enqueue, wait, report. Returns the process exit code.
 *
 * Everything that costs money happens after every input has been checked, so a
 * typo in the third file name fails the run before the first one is uploaded.
 */
export async function runCli(args: readonly string[], queue: JobQueue): Promise<number> {
  let command;
  try {
    command = parseCliArgs(args);
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    err(`fassembly: ${e.message}`);
    err('Run "fassembly --help" for usage.');
    return EXIT_USAGE;
  }

  if (command.kind === 'help') {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  if (command.kind === 'version') {
    out(app.getVersion());
    return 0;
  }

  if (!getApiKey()) {
    err('fassembly: no AssemblyAI API key is set. Open the Fassembly app and add it in Settings.');
    return EXIT_USAGE;
  }

  let files: string[];
  try {
    files = await resolveFiles(command.source);
  } catch (e) {
    err(`fassembly: ${e instanceof Error ? e.message : String(e)}`);
    return EXIT_USAGE;
  }
  if (files.length > MAX_BATCH) {
    err(`fassembly: at most ${MAX_BATCH} recordings per run.`);
    return EXIT_USAGE;
  }

  let specs: JobSpec[];
  try {
    const built = buildSpecs(files, command.options, getSettings(), todayIso());
    specs = await Promise.all(built.map((spec) => validateJobSpec(spec)));
  } catch (e) {
    err(`fassembly: ${e instanceof Error ? e.message : String(e)}`);
    return EXIT_USAGE;
  }

  // Ctrl+C reaches this process only when it shares the terminal's console. When
  // it does, stop cleanly so the queue reports what was already submitted.
  const onInterrupt = () => queue.cancelAll();
  process.once('SIGINT', onInterrupt);
  try {
    const records = await runToCompletion(queue, specs);
    const results = records.map((r) => toCliResult(r, queue.result(r.id)));

    if (command.options.json) {
      out(JSON.stringify(results, null, 2));
    } else {
      for (const r of results) if (r.savedPath) out(r.savedPath);
    }
    for (const line of warningLines(results)) err(line);
    return exitCodeFor(results);
  } finally {
    process.off('SIGINT', onInterrupt);
  }
}

async function resolveFiles(source: CliSource): Promise<string[]> {
  if (source.kind === 'files') return source.files.map((f) => path.resolve(f));

  const dir = source.from ? path.resolve(source.from) : await defaultLatestDir(app.getPath('videos'));
  const newest = await newestRecording(dir).catch((e: NodeJS.ErrnoException) => {
    throw new Error(e.code === 'ENOENT' ? `${dir} does not exist.` : `could not read ${dir}: ${e.message}`);
  });
  if (!newest) throw new Error(`no recordings found in ${dir}.`);
  err(`Latest recording: ${newest}`);
  return [newest];
}

/** Enqueue, start, and resolve with the final records once every job has stopped. */
function runToCompletion(queue: JobQueue, specs: JobSpec[]): Promise<JobRecord[]> {
  const progress = new ProgressPrinter(err);
  return new Promise((resolve) => {
    let ids = new Set<string>();
    const finish = () => {
      const records = queue.list().filter((r) => ids.has(r.id));
      if (records.length === ids.size && records.every((r) => isTerminal(r.status))) {
        unsubscribe();
        resolve(records);
      }
    };
    const unsubscribe = queue.on((event) => {
      if (event.type !== 'updated' || !ids.has(event.job.id)) return;
      progress.update(event.job);
      if (isTerminal(event.job.status)) finish();
    });
    ids = new Set(queue.enqueue(specs));
    queue.start();
  });
}
