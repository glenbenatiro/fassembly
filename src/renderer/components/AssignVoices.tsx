import { useEffect, useMemo, useRef, useState } from 'react';
import type { IdentificationStatus, Utterance } from '../../shared/types';
import { speakerColor } from '../speakerColors';
import { formatTime } from '../util';
import { IconButton, inputSmClass } from './ui';

/**
 * AssemblyAI returns anonymous labels (Speaker A, B, C) unless Speaker
 * Identification matched a name. Renaming them from a bare text box means
 * guessing; this shows each voice's longest line and lets you hear it, so the
 * question is actually answerable.
 */
export function AssignVoices({
  speakers,
  utterances,
  roster,
  remap,
  audioUrl,
  identification,
  note,
  onChange,
}: {
  speakers: string[];
  utterances: Utterance[];
  roster: string[];
  remap: Record<string, string>;
  audioUrl: string | null;
  identification: IdentificationStatus;
  note: string | null;
  onChange: (remap: Record<string, string>) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  // The longest line is the most recognisable, and long enough to judge a voice.
  const samples = useMemo(() => {
    const best = new Map<string, Utterance>();
    for (const u of utterances) {
      const current = best.get(u.speaker);
      if (!current || u.text.length > current.text.length) best.set(u.speaker, u);
    }
    return best;
  }, [utterances]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTimeUpdate = () => {
      if (stopAtRef.current !== null && el.currentTime >= stopAtRef.current) {
        el.pause();
        stopAtRef.current = null;
        setPlaying(null);
      }
    };
    const onEnded = () => setPlaying(null);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
    };
  }, []);

  const toggle = (speaker: string) => {
    const el = audioRef.current;
    const sample = samples.get(speaker);
    if (!el || !sample) return;
    if (playing === speaker) {
      el.pause();
      setPlaying(null);
      return;
    }
    el.currentTime = sample.start / 1000;
    // Cap the snippet so a very long turn does not play out in full.
    stopAtRef.current = Math.min(sample.end, sample.start + 12_000) / 1000;
    void el.play().then(() => setPlaying(speaker)).catch(() => setPlaying(null));
  };

  if (speakers.length === 0) {
    return <p className="text-sm text-ink-soft">No speakers were detected.</p>;
  }

  return (
    <div className="space-y-3">
      {identification === 'success' && (
        <p className="rounded-md border border-pine/30 bg-pine-wash px-2.5 py-1.5 text-xs text-pine-deep">
          Named automatically from your roster. Worth a quick check.
          {note && <> {note}</>}
        </p>
      )}
      {identification === 'uncertain' && (
        <p
          className="rounded-md border border-amber/40 bg-amber-wash px-2.5 py-1.5 text-xs text-ink"
          role="alert"
        >
          <span className="font-medium">Check these before saving.</span>{' '}
          {note ?? 'Automatic naming disagreed with the transcript.'}
        </p>
      )}
      {identification === 'unresolved' && (
        <p className="rounded-md border border-line bg-paper px-2.5 py-1.5 text-xs text-ink-soft">
          Your roster could not be matched automatically - nobody in this recording
          is introduced or addressed by name, and identification reads the words, not
          the voices. Assign them below; the roster is in the dropdown.
        </p>
      )}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />}
      <datalist id="voice-roster">
        {roster.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {speakers.map((speaker) => {
        const sample = samples.get(speaker);
        const color = speakerColor(speaker);
        return (
          <div key={speaker} className="flex items-start gap-2.5">
            <span
              className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-semibold" style={{ color }}>
                  {speaker}
                </span>
                {sample && (
                  <>
                    {audioUrl && (
                      <IconButton
                        label={playing === speaker ? `Stop ${speaker}` : `Play ${speaker}`}
                        onClick={() => toggle(speaker)}
                      >
                        {playing === speaker ? '■' : '▶'}
                      </IconButton>
                    )}
                    <span className="font-mono text-[0.6875rem] text-ink-soft">
                      {formatTime(sample.start)}
                    </span>
                  </>
                )}
              </div>
              {sample && (
                <p className="mt-0.5 line-clamp-2 text-[0.8125rem] italic leading-snug text-ink-soft">
                  “{sample.text}”
                </p>
              )}
              <input
                className={`${inputSmClass} mt-1.5`}
                list="voice-roster"
                value={remap[speaker] ?? speaker}
                aria-label={`Name for ${speaker}`}
                placeholder={speaker}
                // The field starts holding the label ("A"), so select on focus:
                // otherwise naming a speaker means clearing "A" before typing.
                onFocus={(e) => e.target.select()}
                onChange={(e) => onChange({ ...remap, [speaker]: e.target.value })}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
