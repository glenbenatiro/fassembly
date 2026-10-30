import { parseArgs } from 'node:util';
import type { ModelId } from '../shared/types';
import { MODELS } from '../shared/models';

// Command-line parsing for headless runs. Deliberately free of Electron imports,
// like util/async.ts, so the tests can exercise it from a plain node process.

/** Passed by bin/fassembly.mjs ahead of the user's arguments. Never typed by hand. */
export const CLI_MARKER = '--cli';

export const HELP_TEXT = `Usage:
  fassembly <file>...            Transcribe recordings and save them as markdown
  fassembly --latest             Transcribe your newest screen recording

Options:
  -n, --names <list>     Who is in the room, comma separated, e.g. "Ana,Ben"
  -s, --speakers <n>     How many people speak (1-20)
  -m, --model <id>       ${MODELS.map((m) => m.id).join(' | ')}
  -l, --language <code>  Language code, e.g. en. Default: auto-detect
  -o, --out <dir>        Folder to save into
      --latest           Pick the newest recording instead of naming a file
      --from <dir>       Folder --latest looks in. Default: Videos\\Screen Recordings
      --json             Print the result as JSON
  -h, --help             Show this help
  -v, --version          Show the version

Anything you leave out comes from the app's Settings, as it does in the app.
Without a save folder, the transcript is saved next to the recording.

Exit codes: 0 every transcript saved, 1 a job failed, 2 nothing was started.
`;

export interface TranscribeOptions {
  /** Null means "use the app's defaults". */
  names: string[] | null;
  speakers: number | null;
  model: ModelId | null;
  language: string | null;
  out: string | null;
  json: boolean;
}

export type CliSource = { kind: 'files'; files: string[] } | { kind: 'latest'; from: string | null };

export type CliCommand =
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'transcribe'; source: CliSource; options: TranscribeOptions };

/** A mistake in how the command was typed. Reported with a pointer to --help. */
export class UsageError extends Error {}

/**
 * The user's arguments from a full process argv, or null when this is not a
 * command-line run. The launcher always passes `--cli --` before them; the `--`
 * stops Chromium from reading the user's flags as its own switches.
 */
export function cliArgsFrom(argv: readonly string[]): string[] | null {
  const i = argv.indexOf(CLI_MARKER);
  if (i < 0) return null;
  const rest = argv.slice(i + 1);
  return rest[0] === '--' ? rest.slice(1) : rest;
}

const MODEL_IDS = new Set<string>(MODELS.map((m) => m.id));

export function parseCliArgs(args: readonly string[]): CliCommand {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...args],
      allowPositionals: true,
      strict: true,
      options: {
        names: { type: 'string', short: 'n' },
        speakers: { type: 'string', short: 's' },
        model: { type: 'string', short: 'm' },
        language: { type: 'string', short: 'l' },
        out: { type: 'string', short: 'o' },
        latest: { type: 'boolean' },
        from: { type: 'string' },
        json: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (err) {
    // parseArgs throws a TypeError for unknown flags and missing values; its
    // message already names the offending flag.
    throw new UsageError(err instanceof Error ? err.message : String(err));
  }

  const { values, positionals } = parsed;
  if (values.help) return { kind: 'help' };
  if (values.version) return { kind: 'version' };

  let source: CliSource;
  if (values.latest) {
    if (positionals.length) throw new UsageError('Pass files or --latest, not both.');
    source = { kind: 'latest', from: values.from ?? null };
  } else {
    if (values.from !== undefined) throw new UsageError('--from only applies with --latest.');
    if (!positionals.length) {
      throw new UsageError('No recording given. Pass a file, or --latest for your newest one.');
    }
    source = { kind: 'files', files: positionals };
  }

  return {
    kind: 'transcribe',
    source,
    options: {
      names: values.names === undefined ? null : parseNames(values.names),
      speakers: values.speakers === undefined ? null : parseSpeakers(values.speakers),
      model: values.model === undefined ? null : parseModel(values.model),
      language: values.language === undefined ? null : values.language.trim() || null,
      out: values.out === undefined ? null : values.out,
      json: values.json === true,
    },
  };
}

function parseNames(raw: string): string[] {
  const names = raw
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  if (!names.length) throw new UsageError('--names needs at least one name.');
  return names;
}

function parseSpeakers(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 20) {
    throw new UsageError(`--speakers must be a whole number from 1 to 20, not "${raw}".`);
  }
  return n;
}

function parseModel(raw: string): ModelId {
  if (!MODEL_IDS.has(raw)) {
    throw new UsageError(`Unknown model "${raw}". Use one of: ${[...MODEL_IDS].join(', ')}.`);
  }
  return raw as ModelId;
}
