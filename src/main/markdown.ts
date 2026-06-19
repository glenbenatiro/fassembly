import type { SaveRequest, Utterance } from '../shared/types';

// Merge back-to-back utterances from the same speaker into one paragraph so the
// transcript reads cleanly.
function groupUtterances(utterances: Utterance[]): Utterance[] {
  const out: Utterance[] = [];
  for (const u of utterances) {
    const last = out[out.length - 1];
    if (last && last.speaker === u.speaker) {
      last.text = `${last.text} ${u.text}`.trim();
      last.end = u.end;
    } else {
      out.push({ ...u });
    }
  }
  return out;
}

export function renderMarkdown(data: SaveRequest): string {
  const grouped = groupUtterances(data.utterances);
  const participants = data.participants.length
    ? data.participants
    : Array.from(new Set(grouped.map((u) => u.speaker)));

  const frontmatter = [
    '---',
    `date: ${data.isoDate}`,
    `participants: [${participants.join(', ')}]`,
    `source: ${data.sourceFileName}`,
    `model: ${data.model}`,
    '---',
    '',
  ].join('\n');

  const heading = `# Meeting - ${data.isoDate}`;
  const body = grouped.map((u) => `**${u.speaker}:** ${u.text}`).join('\n\n');

  return `${frontmatter}${heading}\n\n${body}\n`;
}
