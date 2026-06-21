import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'ghost' | 'subtle';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-pine text-paper-raised shadow-card hover:bg-pine-bright active:bg-pine-deep',
  ghost: 'border border-line bg-paper-raised text-ink hover:border-ink-faint hover:bg-paper',
  subtle: 'text-ink-soft hover:bg-pine-wash hover:text-pine-deep',
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
      {hint && <span className="mt-1.5 block text-xs text-ink-faint">{hint}</span>}
    </label>
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
      {eyebrow && (
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-pine">{eyebrow}</div>
      )}
      <h1 className="mt-1 font-display text-[1.6rem] font-medium leading-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-1.5 break-all text-sm text-ink-soft">{subtitle}</p>}
    </div>
  );
}

export const inputClass =
  'w-full rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-pine focus:ring-2 focus:ring-pine-wash';
