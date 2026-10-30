import test from 'node:test';
import assert from 'node:assert/strict';
import { cliArgsFrom, parseCliArgs, UsageError } from './args';

test('only a launch carrying the marker is a command-line run', () => {
  assert.equal(cliArgsFrom(['Fassembly.exe']), null);
  assert.equal(cliArgsFrom(['Fassembly.exe', '--squirrel-firstrun']), null);
  assert.deepEqual(cliArgsFrom(['Fassembly.exe', '--cli', '--', 'a.mp4', '-n', 'Dana']), [
    'a.mp4',
    '-n',
    'Dana',
  ]);
  // Development launches put the app path ahead of the marker.
  assert.deepEqual(cliArgsFrom(['electron.exe', '.', '--cli', '--', '--help']), ['--help']);
});

test('files and options parse into a transcribe command', () => {
  const cmd = parseCliArgs(['one.mp4', 'two.m4a', '--names', ' Dana , Sebastian ,', '-s', '2', '-m', 'universal-2']);
  assert.deepEqual(cmd, {
    kind: 'transcribe',
    source: { kind: 'files', files: ['one.mp4', 'two.m4a'] },
    options: {
      names: ['Dana', 'Sebastian'],
      speakers: 2,
      model: 'universal-2',
      language: null,
      out: null,
      json: false,
    },
  });
});

test('anything left out is null, so the app settings fill it in', () => {
  const cmd = parseCliArgs(['--latest']);
  assert.deepEqual(cmd, {
    kind: 'transcribe',
    source: { kind: 'latest', from: null },
    options: { names: null, speakers: null, model: null, language: null, out: null, json: false },
  });
  assert.deepEqual(parseCliArgs(['--latest', '--from', 'D:\\Calls', '--json']), {
    kind: 'transcribe',
    source: { kind: 'latest', from: 'D:\\Calls' },
    options: { names: null, speakers: null, model: null, language: null, out: null, json: true },
  });
});

test('help and version win over everything else', () => {
  assert.deepEqual(parseCliArgs(['a.mp4', '--help']), { kind: 'help' });
  assert.deepEqual(parseCliArgs(['-v']), { kind: 'version' });
});

test('mistakes are usage errors that name the problem', () => {
  const cases: [string[], RegExp][] = [
    [[], /No recording given/],
    [['a.mp4', '--latest'], /not both/],
    [['a.mp4', '--from', 'x'], /only applies with --latest/],
    [['a.mp4', '--speakers', '0'], /1 to 20/],
    [['a.mp4', '--speakers', '2.5'], /1 to 20/],
    [['a.mp4', '--model', 'whisper'], /Unknown model "whisper"/],
    [['a.mp4', '--names', ' , '], /at least one name/],
    [['a.mp4', '--colour'], /--colour/],
    [['a.mp4', '--out'], /--out/],
  ];
  for (const [args, message] of cases) {
    assert.throws(() => parseCliArgs(args), (err: unknown) => {
      assert.ok(err instanceof UsageError, `${args.join(' ')} should be a usage error`);
      assert.match(err.message, message);
      return true;
    });
  }
});
