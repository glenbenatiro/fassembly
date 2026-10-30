# Fassembly

A small cross-platform desktop app that turns meeting recordings into clean, speaker-labelled markdown transcripts. It wraps the manual steps (convert the file, upload to AssemblyAI, pick the model, set the speakers, copy the result into markdown) into one quick flow.

Built with Electron, React, TypeScript, and Vite via Electron Forge.

## What it does

1. You drop in as many meeting recordings as you like - audio or video.
2. You set the model, expected speaker count, language, and who is in the room once, as batch defaults. Any individual recording can override them.
3. You press Transcribe. Recordings run **in parallel** (up to 10 at a time, 3 by default), each with its own progress.
4. For each finished one you confirm who is who - you get each voice's longest line and a play button - then save it as markdown.

The audio extraction step keeps uploads small. Speaker names you provide up front are sent to AssemblyAI Speaker Identification and offered as suggestions when you confirm speakers afterwards.

Parallelism is capped separately for the two stages: the slider controls how many recordings are in flight (network-bound), while a smaller limit controls concurrent ffmpeg extractions (CPU-bound). Uploads are streamed, so memory stays flat no matter how large the batch.

## Requirements

- Node.js 22 (see `.nvmrc`)
- An AssemblyAI API key. New accounts get free credits. Get a key from the [AssemblyAI dashboard](https://www.assemblyai.com/app).

## Getting started

```bash
npm install
npm start
```

On first run, open the Settings tab and paste your AssemblyAI API key. The key is stored encrypted on your device using the OS keychain (Electron safeStorage). It is never written into the project or sent anywhere except AssemblyAI.

While you are in Settings, you can also set a default output folder for each job, so saved transcripts land in the right place automatically.

## Command line

The `fassembly` command transcribes recordings from a terminal without opening the window. It runs the same pipeline as the app, with the same settings and the same stored API key, and saves the markdown in one go.

```powershell
fassembly "D:\Calls\standup.mp4" --names "Ana,Ben"
fassembly --latest --names "Ana,Ben" --speakers 2
fassembly one.mp4 two.m4a --out D:\Notes --json
```

`--latest` picks the newest recording in `Videos\Screen Recordings`, where the Windows Snipping Tool saves them, or in `Videos` if that folder does not exist. `--from <dir>` points it somewhere else. `fassembly --help` lists every option.

Anything you leave out comes from Settings, as it does for the app's batch defaults. The transcript is always saved: to `--out`, else your default output folder, else next to the recording. There is no "who is who" step. Names passed with `--names` are applied when AssemblyAI Speaker Identification resolves them and the transcript backs them up, the same check the app runs; otherwise the speakers stay as `A`, `B` and the command says so.

Progress goes to stderr, and the saved paths (or the `--json` result) go to stdout, so the output pipes cleanly. The exit code is `0` when every transcript was saved, `1` when a job failed or could not be saved, and `2` when nothing was started: a typo in the command, a missing file, or no API key.

### Putting it on your PATH

A command works in a terminal when a launcher for it sits in a folder listed in your `Path` environment variable. Installers usually add a folder of their own. Here npm does it instead, with no installer and no Path editing:

```bash
npm install
npm run package   # builds out/Fassembly-win32-x64/Fassembly.exe
npm link          # writes fassembly.cmd and fassembly.ps1 into npm's global folder, already on Path
```

Set your API key in the app first, then open a new terminal and run `fassembly --version`.

To update, run `git pull`, `npm ci` and `npm run package`. The link points at this checkout, so it keeps working. With nvm-windows the link belongs to the active Node version, so run `npm link` again after `nvm use`.

`bin/fassembly.mjs` is only a launcher: it starts `Fassembly.exe` without a window and waits for it. The work has to happen inside the packaged app because the API key is encrypted with Electron safeStorage, and the app's fuses deliberately disable running it as plain Node (`RunAsNode` in `forge.config.ts`), which is the shortcut other Electron command lines take. Like the app, the command is Windows only for now.

### From WSL

WSL adds Windows' Path to its own by default, so `fassembly` works there too. It still runs on Windows: the launcher converts absolute paths such as `/mnt/d/calls/standup.mp4` with `wslpath` before handing them over. WSL needs its own Node install to run the launcher.

## Building installers

```bash
npm run make
```

This produces an installer for your current platform under `out/`. Electron Forge is configured with makers for Windows, macOS, and Linux. On Windows, the installer lands at `out/make/squirrel.windows/x64/<name> Setup.exe`.

Run that installer rather than launching `out/Fassembly-win32-x64/Fassembly.exe` by hand. Squirrel installs the app into `%LOCALAPPDATA%\fassembly` and creates the Desktop and Start menu shortcuts, and it is the Start menu shortcut that makes the app searchable - a loose exe under `out/` is never indexed. The Start menu shortcut is filed under the company name, which Forge reads from `author` in `package.json`.

### The icon

`assets/icon.ico` is generated rather than drawn:

```bash
npm run icon
```

`scripts/make-icon.mjs` renders the same mark the app header draws, at every size Windows asks for between 16 and 256px. Keeping it in code rather than in an exported bitmap means the Start menu tile and the running window cannot drift apart. Commit the result: the build reads the `.ico` and never runs the script. Regenerate after changing `Mark` in `src/renderer/components/Nav.tsx` or the palette in `tailwind.config.js`.

## Branches

Two long-lived branches:

- **`main`** - integration. Every change lands here by pull request. CI (`.github/workflows/ci.yml`) runs lint and typecheck on each PR.
- **`production`** - a pointer at a known-good `main` commit. **Fast-forward only**, so it can only ever reference a commit that already passed CI on `main`. Every commit that lands here is released.

## Conventions

**Commits follow [Conventional Commits](https://www.conventionalcommits.org).** The subject is `type(scope): summary`, lower case after the colon, imperative, no trailing full stop. Squash-merging a PR takes its title as the subject, so the **PR title** has to be conventional too, not just the commits inside it.

Types in use: `feat`, `fix`, `ci`, `docs`, `chore`, `refactor`, `test`. Scopes track the source layout - `cli`, `jobs`, `stt`, `ui`, `build`, `release` - and a change spanning two takes both, as in `feat(jobs,ui):`.

**No em dashes, anywhere.** Not in source, comments, docs, commit messages, or release notes. Use a spaced hyphen ` - ` where you would reach for one. The single exception is the separator character class in `src/main/stt/identify.ts`, because transcripts genuinely contain em dashes and the matcher needs to handle them; it is written as the escape `\u2014` so no literal one appears in the tree. `npm run lint:prose` fails the build on a literal em dash.

**No personal data in the repo.** Test fixtures use an invented cast. Never paste real transcript lines, names, or meeting content into source, tests, or commit messages, however convenient a real failing case is - transcripts are exactly the kind of input that carries other people's names, and a fixture outlives the bug it was written for.

## Releasing

Installers are distributed as **GitHub Release assets** (build artifacts are not committed). Releasing is promoting `main` to `production`:

```bash
# 1. On main, bump the version (the release is named after it):
npm version --no-git-tag-version minor
git commit -am "Release v1.1.0" && git push

# 2. Promote:
npm run promote
```

`npm run promote` fast-forwards `production` to `origin/main` and pushes it. A non-fast-forward promote fails locally rather than creating a merge commit.

That push triggers `.github/workflows/release.yml`, which tags the commit `v<version>`, builds the Windows installer on a Windows runner, and publishes a GitHub Release via Electron Forge's GitHub publisher. Don't create tags by hand - the workflow owns them.

If you promote without bumping the version, the workflow **fails on purpose** with `vX.Y.Z already exists`, because Forge names the Release from `package.json` rather than from the tag. Bump and promote again.

### Release notes

The workflow seeds the body with the closing trailer only. **The notes themselves are written by hand** before the release is announced, because the useful part is the reasoning, and no generator produces that from commit subjects.

The house style:

- The title is the tag verbatim, `v` prefix included.
- Explanatory **prose paragraphs, not bullet dumps**. A reader should come away understanding why a change was made, not just that it was.
- `## What changed` first, then an optional release-specific section: `Known limitations`, `Measured`, `Verified`.
- Shorthand numbers (`~0.9s`, `13-15x`, `164 MB`) and ISO dates (`2026-07-28`).
- PR references inline, as `(#4)`.
- Close with the trailer `Released <ISO date>, at commit <short sha>.`
- No rollback section. Recovery is `git reset --hard <previous tag>` on `production`, which belongs here in the README rather than repeated in every release.

The installer is currently unsigned, so Windows SmartScreen shows an "unknown publisher" prompt - users click **More info → Run anyway**. Code signing (an Authenticode certificate) removes this.

Only Windows is built. `forge.config.ts` ships `ffmpeg.exe` via `extraResource`, so the macOS and Linux makers would fail at packaging until that is made platform-aware.

## How it works

- Main process (`src/main/`) does all the privileged work: file dialogs, ffmpeg audio extraction, the AssemblyAI requests, settings storage, and writing markdown.
- **The job queue (`src/main/jobs/`) owns all transcription state.** The renderer is a view over it, not the source of truth, so progress survives a tab switch or a renderer reload. Every progress event carries a job id.
- Preload (`src/preload.ts`) exposes a small typed `window.api` over a context bridge. The renderer has no direct Node or network access.
- Renderer (`src/renderer/`) is the React UI: a queue on the left, a detail pane on the right.
- A custom `fassembly-media://` protocol serves one job's extracted audio to the renderer so speaker snippets can be played, without granting it file access - the renderer only ever names a job id.
- **Command-line runs** (`src/main/cli.ts`) drive the same queue with no window. `bin/fassembly.mjs` starts the app with a `--cli` marker, and `src/main.ts` then skips the window, IPC, CSP and media protocol. The parsing, defaults and output live in `src/cli/`, free of Electron so they can be unit tested.

Speech-to-text sits behind a small provider interface (`src/main/stt/`). AssemblyAI is the only provider today, but swapping or adding one is a single-file change.

Universal-3.5 Pro is $0.21 per audio hour at the time of writing; with diarization the practical cost is around $0.25. Universal-2 is cheaper ($0.15) and covers 99 languages rather than 18.

**Stopping a job does not stop AssemblyAI.** There is no cancel endpoint, so once a transcript has been submitted it may still complete and be billed. Cancelling stops the app waiting for it; retrying resumes polling the same transcript rather than re-uploading.

## Security notes

- Context isolation is on, the renderer is sandboxed, and Node integration is off.
- A Content Security Policy is applied to the renderer.
- The API key is encrypted at rest and never leaves the main process except in the request to AssemblyAI.

## Roadmap

- In-app recording (screen plus microphone and system audio) using native Electron capture and `electron-audio-loopback`, feeding straight into the same pipeline. There is a placeholder Record tab for this now.

## Project layout

```
bin/
  fassembly.mjs        the launcher `npm link` puts on PATH
src/
  main.ts              app entry, window, CSP, queue wiring, command-line mode
  preload.ts           context bridge (window.api)
  cli/                 command-line parsing, defaults and output (no Electron)
  main/
    cli.ts             one headless run: parse, enqueue, wait, report
    ipc.ts             IPC handlers
    settings.ts        JSON settings store + safeStorage
    ffmpeg.ts          audio extraction (abortable, real progress)
    markdown.ts        transcript -> markdown
    mediaProtocol.ts   fassembly-media:// for speaker snippet playback
    jobs/
      queue.ts         the job manager: scheduling, state, events
      runner.ts        one job's pipeline: extract -> upload -> transcribe -> save
      validate.ts      validates renderer-supplied job specs
      errors.ts        maps failures to actionable messages
    stt/
      assemblyai.ts    provider: submit + poll with backoff
      upload.ts        streamed upload with byte progress
      http.ts          retry, 429 handling, request pacing
    util/              semaphore, async helpers, file + filename helpers
  renderer/
    App.tsx            queue state, batch defaults vs per-job overrides
    screens/           Queue (left rail), JobDetail (right pane), Record, Settings
    components/        Dropzone, JobRow, BatchDefaults, AssignVoices, ...
  shared/
    types.ts           types shared across all layers
    models.ts          the model list, single source of truth
    dates.ts, paths.ts helpers the app and the command line share
```
