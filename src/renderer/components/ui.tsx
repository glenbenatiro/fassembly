import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'ghost' | 'subtle' | 'danger';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-pine text-paper-raised shadow-card hover:bg-pine-bright active:bg-pine-deep',
  ghost: 'border border-line bg-paper-raised text-ink hover:border-ink-faint hover:bg-paper',
  subtle: 'text-ink-soft hover:bg-pine-wash hover:text-pine-deep',
  danger: 'border border-brick/30 bg-brick-wash text-brick hover:border-brick/60',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-pine/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-40';
  return <button className={`${base} ${VARIANTS[variant]} ${className}`} {...props} />;
}

/** Compact square button for row actions: cancel, retry, remove. */
export function IconButton({
  label,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-soft outline-none transition-colors hover:bg-paper hover:text-ink focus-visible:ring-2 focus-visible:ring-pine/40 ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-paper-raised p-6 shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

/** The one heading size. Previously a `text-[1.6rem]` literal repeated in four files. */
export function PageTitle({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h1 className={`font-display text-[1.6rem] font-medium leading-tight text-ink ${className}`}>
      {children}
    </h1>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-pine">{children}</div>
  );
}

export function StepHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <PageTitle className="mt-1">{title}</PageTitle>
      {subtitle && <p className="mt-1.5 break-all text-sm text-ink-soft">{subtitle}</p>}
    </div>
  );
}

/**
 * Determinate when given a percent, indeterminate otherwise. The old UI carried
 * `percent` through the IPC contract but never rendered it anywhere.
 */
export function ProgressBar({
  percent,
  tone = 'pine',
  className = '',
}: {
  percent: number | null;
  tone?: 'pine' | 'brick';
  className?: string;
}) {
  const color = tone === 'brick' ? 'bg-brick' : 'bg-pine';
  return (
    <div
      className={`h-1 w-full overflow-hidden rounded-full bg-line ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent === null ? undefined : Math.round(percent)}
    >
      {percent === null ? (
        <div className={`h-full w-1/3 animate-indeterminate rounded-full ${color}`} />
      ) : (
        <div
          className={`h-full rounded-full ${color} transition-[width] duration-300`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      )}
    </div>
  );
}

export function Chip({
  children,
  tone = 'quiet',
}: {
  children: ReactNode;
  tone?: 'quiet' | 'accent';
}) {
  const styles =
    tone === 'accent'
      ? 'border-pine/30 bg-pine-wash text-pine-deep'
      : 'border-line bg-paper text-ink-soft';
  return (
    <span
      className={`inline-flex max-w-[11rem] items-center truncate rounded-full border px-1.5 py-px text-[0.6875rem] leading-4 ${styles}`}
    >
      {children}
    </span>
  );
}

export function Banner({
  tone,
  children,
}: {
  tone: 'amber' | 'brick' | 'pine';
  children: ReactNode;
}) {
  const styles = {
    amber: 'border-amber/30 bg-amber-wash text-amber',
    brick: 'border-brick/30 bg-brick-wash text-brick',
    pine: 'border-pine/30 bg-pine-wash text-pine-deep',
  }[tone];
  return (
    <div
      role={tone === 'brick' ? 'alert' : undefined}
      className={`rounded-lg border px-4 py-3 text-sm ${styles}`}
    >
      {children}
    </div>
  );
}

export const inputClass =
  'w-full rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-pine focus:ring-2 focus:ring-pine-wash';

export const inputSmClass =
  'w-full rounded-md border border-line bg-paper-raised px-2 py-1 text-[0.8125rem] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-pine focus:ring-2 focus:ring-pine-wash';
