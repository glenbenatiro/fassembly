# Fassembly

A small cross-platform desktop app that turns meeting recordings into clean, speaker-labelled markdown transcripts. It wraps the manual steps (convert the file, upload to AssemblyAI, pick the model, set the speakers, copy the result into markdown) into one quick flow.

Built with Electron, React, TypeScript, and Vite via Electron Forge.

## What it does

1. You drop in a meeting recording (audio or video).
2. You pick which job it belongs to and, if you want, the expected number of speakers and their names.
3. The app strips the audio with a bundled ffmpeg, sends it to AssemblyAI, and gets back a transcript with speakers labelled.
4. You review the transcript, fix any speaker names, and save it as markdown into the right folder.

The audio extraction step keeps uploads small. Speaker names you provide up front are passed to AssemblyAI Speaker Identification, so the transcript comes back already named.

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

## Releasing

Installers are distributed as **GitHub Release assets** (build artifacts are not committed). A GitHub Actions workflow (`.github/workflows/release.yml`) builds the Windows installer and uploads it to a draft Release when you push a version tag:

```bash
# 1. Bump the version in package.json to match the tag you will push.
# 2. Commit it, then:
git tag v1.0.0
git push origin v1.0.0
```

The workflow builds on a Windows runner and publishes via Electron Forge's GitHub publisher to a **draft** Release titled after the version (e.g. `v1.0.0`). Review it on the repo's Releases page, then click **Publish release** to make it public. You can also trigger a test run from the Actions tab (manual `workflow_dispatch`).

The installer is currently unsigned, so Windows SmartScreen shows an "unknown publisher" prompt — users click **More info → Run anyway**. Code signing (an Authenticode certificate) removes this.

## How it works

- Main process (`src/main/`) does all the privileged work: file dialogs, ffmpeg audio extraction, the AssemblyAI request, settings storage, and writing markdown.
- Preload (`src/preload.ts`) exposes a small typed `window.api` over a context bridge. The renderer has no direct Node or network access.
- Renderer (`src/renderer/`) is the React UI: a short wizard of select, configure, transcribe, review, and save.

Speech-to-text sits behind a small provider interface (`src/main/stt/`). AssemblyAI is the only provider today, but swapping or adding one is a single-file change.

The cost on AssemblyAI for this setup (Universal-3 Pro plus diarization plus speaker identification) is about $0.25 per audio hour at the time of writing.

## Security notes

- Context isolation is on, the renderer is sandboxed, and Node integration is off.
- A Content Security Policy is applied to the renderer.
- The API key is encrypted at rest and never leaves the main process except in the request to AssemblyAI.

## Roadmap

- In-app recording (screen plus microphone and system audio) using native Electron capture and `electron-audio-loopback`, feeding straight into the same pipeline. There is a placeholder Record tab for this now.

## Project layout

```
src/
  main.ts              app entry, window, CSP
  preload.ts           context bridge (window.api)
  main/
    ipc.ts             IPC handlers
    settings.ts        electron-store + safeStorage
    ffmpeg.ts          audio extraction
    markdown.ts        transcript -> markdown
    stt/               speech-to-text provider interface + AssemblyAI
  renderer/
    App.tsx            wizard state machine
    screens/           one file per step, plus Record and Settings
    components/        shared UI pieces
  shared/
    types.ts           types shared across all layers
```
