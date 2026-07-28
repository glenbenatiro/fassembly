import fs from 'node:fs';
import { Readable } from 'node:stream';
import { HttpError } from './http';

export interface UploadOptions {
  baseUrl: string;
  apiKey: string;
  audioPath: string;
  signal: AbortSignal;
  onProgress(sent: number, total: number): void;
  /** No bytes moved for this long means the connection is dead. */
  stallTimeoutMs?: number;
}

/**
 * Stream the extracted audio to AssemblyAI and return the upload URL.
 *
 * The previous implementation read the entire file into memory before sending
 * it. That was merely wasteful for one job; with ten in flight it is a real
 * memory problem, since a batch of hour-long meetings is hundreds of MB.
 *
 * Streaming here is a plain fetch with a web-stream body. `duplex: 'half'` is
 * required by undici when the body is a stream, and an explicit content-length
 * keeps the request out of chunked transfer encoding. Backpressure comes for
 * free: memory in flight stays around the read buffer size regardless of file
 * size. The two casts exist only because the DOM lib's RequestInit has no
 * `duplex` and Node's web ReadableStream is a structurally distinct type.
 */
export async function uploadAudio(opts: UploadOptions): Promise<string> {
  const { size } = await fs.promises.stat(opts.audioPath);
  opts.signal.throwIfAborted();

  const file = fs.createReadStream(opts.audioPath, { highWaterMark: 1 << 20 });
  let sent = 0;
  let lastByteAt = Date.now();
  file.on('data', (chunk: string | Buffer) => {
    sent += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
    lastByteAt = Date.now();
    opts.onProgress(sent, size);
  });

  const stallTimeoutMs = opts.stallTimeoutMs ?? 120_000;
  const stalled = new AbortController();
  const watchdog = setInterval(() => {
    if (Date.now() - lastByteAt > stallTimeoutMs) {
      stalled.abort(new Error('Upload stalled with no data sent'));
    }
  }, 5_000);
  const signal = AbortSignal.any([opts.signal, stalled.signal]);

  try {
    const res = await fetch(`${opts.baseUrl}/v2/upload`, {
      method: 'POST',
      headers: {
        authorization: opts.apiKey,
        'content-type': 'application/octet-stream',
        'content-length': String(size),
      },
      body: Readable.toWeb(file) as unknown as ReadableStream<Uint8Array>,
      duplex: 'half',
      signal,
    } as RequestInit & { duplex: 'half' });

    if (!res.ok) throw await HttpError.from(res);
    const json = (await res.json()) as { upload_url: string };
    if (!json.upload_url) throw new Error('AssemblyAI accepted the upload but returned no URL.');
    return json.upload_url;
  } finally {
    clearInterval(watchdog);
    // Explicit, not incidental: on Windows the open handle blocks deleting the
    // temp mp3 for as long as it is held, including after an aborted request.
    file.destroy();
  }
}
