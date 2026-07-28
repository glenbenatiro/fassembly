import type { IdentificationStatus, Utterance } from '../../shared/types';

/**
 * Turning AssemblyAI's Speaker Identification result into names we can trust.
 *
 * Three things go wrong in practice, all of them observed on real recordings:
 *
 *  1. It returns an *identity* mapping ({ A: 'A' }) with status "success" when
 *     the audio gave it nothing to work with.
 *  2. It resolves only some speakers, leaving the rest as bare labels, even
 *     when the roster makes the remainder deducible.
 *  3. It can be confidently *wrong*: it reads "Hi Dana, sorry I'm late" as
 *     evidence that the person speaking is Dana, when being addressed by a name
 *     is precisely evidence that you are *not* that person.
 *
 * (3) is the dangerous one. Bare A/B labels are honest about being unknown; an
 * inverted mapping looks finished and puts one person's words in the other's
 * mouth. So the rule here is: never trust the mapping on its own - check it
 * against who actually gets addressed, and refuse to assert a name we cannot
 * corroborate.
 */

export interface IdentificationResult {
  /** Diarized label -> final name. Null when nothing could be resolved. */
  mapping: Record<string, string> | null;
  status: IdentificationStatus;
  /** Human-readable reason, shown in the UI when status is 'uncertain'. */
  note: string | null;
}

export function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(
        prev[j] + 1, // deletion
        prev[j - 1] + 1, // insertion
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1), // substitution
      );
      diagonal = prev[j];
      prev[j] = next;
    }
  }
  return prev[b.length];
}

/** Longer names drift more in transcription, so they get a larger budget. */
function budgetFor(a: string, b: string): number {
  return Math.max(a.length, b.length) >= 8 ? 2 : 1;
}

function near(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x === y || editDistance(x, y) <= budgetFor(x, y);
}

/**
 * Identification names a speaker with whatever spelling the recogniser heard:
 * a roster of "Dana" comes back "Dena", "Ana" comes back "Anna". The user
 * typed the roster, so prefer their spelling.
 *
 * Deliberately conservative - a wrong name is worse than an oddly spelled one.
 * Only an unambiguous nearest match snaps; a tie snaps nothing.
 */
export function snapToRoster(name: string, roster: string[]): string {
  const candidate = name.trim().toLowerCase();
  if (!candidate || roster.length === 0) return name;

  const exact = roster.filter((r) => r.toLowerCase() === candidate);
  if (exact.length === 1) return exact[0];

  let best: string | null = null;
  let bestDistance = Infinity;
  let tied = false;

  for (const entry of roster) {
    const other = entry.toLowerCase();
    const distance = editDistance(candidate, other);
    if (distance > budgetFor(candidate, other)) continue;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry;
      tied = false;
    } else if (distance === bestDistance) {
      tied = true;
    }
  }

  return best && !tied ? best : name;
}

const GREETING = /\b(hi|hey|hello|thanks|thank you|sorry|bye|goodbye|good morning|good evening|welcome)\b/i;

/**
 * Does this utterance *address* someone by `name`, as opposed to merely
 * mentioning it, or claiming it?
 *
 * Two shapes count: a greeting followed closely by the name ("thank you so
 * much, Bastian"), and the name followed by a request ("Dana, whenever you have
 * time..."). A name immediately followed by another capitalised word is
 * skipped: "hi Dena Test" is a demo record, not a person being greeted.
 */
export function addressesName(text: string, name: string): boolean {
  const tokens = text.match(/[A-Za-z']+/g) ?? [];
  for (let i = 0; i < tokens.length; i++) {
    if (!near(tokens[i], name)) continue;

    // "Dena Test" - part of a longer proper noun, not a vocative.
    const after = text.slice(text.indexOf(tokens[i]) + tokens[i].length);
    if (/^\s+[A-Z][a-z]/.test(after)) continue;

    // A greeting within the preceding few words.
    if (GREETING.test(tokens.slice(Math.max(0, i - 4), i).join(' '))) return true;

    // The name, then a request aimed at them.
    if (/^[,\s]*\b(can|could|would|will|do|did|are|is|please|whenever|if)\b/i.test(after)) return true;
  }
  return false;
}

/**
 * "I'm Dana", "my name is Dana", "That's me. Dana Whitfield" - an actual claim
 * to the name, which outweighs merely saying it.
 *
 * The separator deliberately allows a sentence break: people really do say
 * "That's me. Dana Whitfield." when typing themselves into a demo, and an
 * earlier version that stopped at the full stop missed exactly that case.
 *
 * The separator class still matches an em dash, because transcripts genuinely
 * contain them, but spells it as a unicode escape so that no literal one has
 * to appear anywhere in this repo.
 */
export function claimsName(text: string, name: string): boolean {
  const re = /\b(i'?m|i am|this is|my name is|that'?s me|it'?s)\b[\s.,:;\u2014-]{0,4}([A-Za-z']+)/gi;
  for (const m of text.matchAll(re)) {
    if (near(m[2], name)) return true;
  }
  return false;
}

/**
 * Does the evidence contradict assigning `name` to this speaker? True when they
 * address that name more often than they claim it - you say the other person's
 * name far more than your own.
 */
function contradicts(utterances: Utterance[], label: string, name: string): boolean {
  let addressed = 0;
  let claimed = 0;
  for (const u of utterances) {
    if (u.speaker !== label) continue;
    if (addressesName(u.text, name)) addressed++;
    if (claimsName(u.text, name)) claimed++;
  }
  return addressed > claimed;
}

/**
 * Two speakers, two names, nobody identified: decide it from who addresses whom.
 * Whoever says "thanks, Sebastian" is not Sebastian, so the other one is.
 *
 * Requires the evidence to be one-sided - exactly one speaker addresses the
 * name, the other never does, and the addresser never claims it - and requires
 * every name that yields a conclusion to agree. Anything murkier returns null.
 */
function inferFromAddress(
  utterances: Utterance[],
  labels: string[],
  roster: string[],
): Record<string, string> | null {
  const [l1, l2] = labels;
  let verdict: Record<string, string> | null = null;

  for (const name of roster) {
    const other = roster.find((r) => r !== name);
    if (!other) continue;

    const addressedBy = labels.filter((l) =>
      utterances.some((u) => u.speaker === l && addressesName(u.text, name)),
    );
    if (addressedBy.length !== 1) continue;

    const speaker = addressedBy[0];
    if (utterances.some((u) => u.speaker === speaker && claimsName(u.text, name))) continue;

    // The one doing the addressing is the *other* person.
    const candidate =
      speaker === l1 ? { [l1]: other, [l2]: name } : { [l1]: name, [l2]: other };

    if (verdict && JSON.stringify(verdict) !== JSON.stringify(candidate)) return null;
    verdict = candidate;
  }

  return verdict;
}

export function resolveIdentification({
  rawMapping,
  utterances,
  roster,
}: {
  rawMapping: Record<string, string>;
  utterances: Utterance[];
  roster: string[];
}): IdentificationResult {
  if (roster.length === 0) return { mapping: null, status: 'not-requested', note: null };

  const labels = Array.from(new Set(utterances.map((u) => u.speaker)));

  // A mapping coming back is not the same as identification succeeding: with
  // nothing to go on it still returns one, just an identity mapping. Only
  // entries that actually renamed a label count.
  const mapping: Record<string, string> = {};
  for (const [label, name] of Object.entries(rawMapping)) {
    if (typeof name !== 'string') continue;
    const trimmed = name.trim();
    if (!trimmed || trimmed === label) continue;
    mapping[label] = snapToRoster(trimmed, roster);
  }

  // Deduction: with as many roster names as speakers, one name left over and
  // one label left over, there is only one possibility. No guesswork.
  const unresolved = labels.filter((l) => !(l in mapping));
  const used = new Set(Object.values(mapping).map((n) => n.toLowerCase()));
  const spare = roster.filter((r) => !used.has(r.toLowerCase()));
  let deduced = false;
  if (labels.length === roster.length && unresolved.length === 1 && spare.length === 1) {
    mapping[unresolved[0]] = spare[0];
    deduced = true;
  }

  const entries = Object.entries(mapping);

  // Nothing resolved, but a two-person call is still decidable if one of them
  // addresses the other by name: whoever says "thanks, Sebastian" is not
  // Sebastian. Only when the evidence is one-sided, and the result is flagged
  // for review rather than asserted.
  if (entries.length === 0 && labels.length === 2 && roster.length === 2) {
    const inferred = inferFromAddress(utterances, labels, roster);
    if (inferred) {
      return {
        mapping: inferred,
        status: 'uncertain',
        note: 'Nobody introduced themselves, so these names come from who addresses whom - one speaker calls the other by name. Please confirm.',
      };
    }
  }

  if (entries.length === 0) {
    return {
      mapping: null,
      status: 'unresolved',
      note: 'Nobody in this recording is introduced or addressed by name.',
    };
  }

  const bad = entries.filter(([label, name]) => contradicts(utterances, label, name));
  if (bad.length === 0) {
    return {
      mapping,
      status: 'success',
      note: deduced ? 'One speaker was identified; the other follows from your roster.' : null,
    };
  }

  // Two speakers, both assignments contradicted, and swapping clears both -
  // that is a closed case, not a guess, so correct it and say so.
  if (entries.length === 2 && bad.length === 2) {
    const [[l1, n1], [l2, n2]] = entries;
    const swapped = { [l1]: n2, [l2]: n1 };
    const stillBad = Object.entries(swapped).filter(([l, n]) => contradicts(utterances, l, n));
    if (stillBad.length === 0) {
      return {
        mapping: swapped,
        status: 'uncertain',
        note: 'The two speakers looked swapped - each was assigned a name they use to address the other - so they have been switched back. Worth confirming.',
      };
    }
  }

  // Otherwise refuse to assert what we cannot corroborate. Bare labels are
  // honest about being unknown; a wrong name is confidently wrong.
  return {
    mapping: null,
    status: 'uncertain',
    note: `Automatic naming was discarded: ${bad
      .map(([, n]) => n)
      .join(' and ')} appeared to be assigned to whoever was addressing them, not to themselves.`,
  };
}
