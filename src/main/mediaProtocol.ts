import { net, protocol } from 'electron';
import { pathToFileURL } from 'node:url';

export const MEDIA_SCHEME = 'fassembly-media';

/**
 * Lets the renderer play a job's extracted audio so speakers can be identified
 * by ear, without granting it file access.
 *
 * The renderer only ever names a job id. Resolving that id to a path happens
 * here, against the queue, so there is no way to ask for an arbitrary file.
 */

/** Must run before app 'ready'. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        stream: true, // required for <audio> range requests / seeking
        supportFetchAPI: true,
      },
    },
  ]);
}

/** Must run after app 'ready'. */
export function handleMediaProtocol(resolveJobAudio: (jobId: string) => string | null): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    let jobId: string;
    try {
      jobId = new URL(request.url).hostname;
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    const filePath = resolveJobAudio(jobId);
    if (!filePath) return new Response('Not found', { status: 404 });
    // net.fetch handles Range requests against file: URLs, which is what makes
    // seeking to a speaker's timestamp work.
    return net.fetch(pathToFileURL(filePath).toString(), {
      headers: request.headers,
      bypassCustomProtocolHandlers: true,
    });
  });
}

export function mediaUrlFor(jobId: string): string {
  return `${MEDIA_SCHEME}://${jobId}/audio.mp3`;
}
