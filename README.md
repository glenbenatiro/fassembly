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

## Building installers

```bash
npm run make
```

This produces an installer for your current platform under `out/`. Electron Forge is configured with makers for Windows, macOS, and Linux. On Windows, the installer lands at `out/make/squirrel.windows/x64/<name> Setup.exe`.

## Branches

Two long-lived branches:

- **`main`** - integration. Every change lands here by pull request. CI (`.github/workflows/ci.yml`) runs lint and typecheck on each PR.
- **`production`** - a pointer at a known-good `main` commit. **Fast-forward only**, so it can only ever reference a commit that already passed CI on `main`. Every commit that lands here is released.

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

That push triggers `.github/workflows/release.yml`, which tags the commit `v<version>`, builds the Windows installer on a Windows runner, publishes a GitHub Release via Electron Forge's GitHub publisher, and fills in generated release notes. Don't create tags by hand - the workflow owns them.

If you promote without bumping the version, the workflow **fails on purpose** with `vX.Y.Z already exists`, because Forge names the Release from `package.json` rather than from the tag. Bump and promote again.

The installer is currently unsigned, so Windows SmartScreen shows an "unknown publisher" prompt - users click **More info → Run anyway**. Code signing (an Authenticode certificate) removes this.

Only Windows is built. `forge.config.ts` ships `ffmpeg.exe` via `extraResource`, so the macOS and Linux makers would fail at packaging until that is made platform-aware.

## How it works

- Main process (`src/main/`) does all the privileged work: file dialogs, ffmpeg audio extraction, the AssemblyAI requests, settings storage, and writing markdown.
- **The job queue (`src/main/jobs/`) owns all transcription state.** The renderer is a view over it, not the source of truth, so progress survives a tab switch or a renderer reload. Every progress event carries a job id.
- Preload (`src/preload.ts`) exposes a small typed `window.api` over a context bridge. The renderer has no direct Node or network access.
- Renderer (`src/renderer/`) is the React UI: a queue on the left, a detail pane on the right.
- A custom `fassembly-media://` protocol serves one job's extracted audio to the renderer so speaker snippets can be played, without granting it file access - the renderer only ever names a job id.

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
src/
  main.ts              app entry, window, CSP, queue wiring
  preload.ts           context bridge (window.api)
  main/
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
```
