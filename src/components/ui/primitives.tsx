import React, { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

/* Shared building blocks for the redesigned surfaces. They use the semantic
   tokens from index.css (canvas, surface, ink, brand, gold, ...) so they follow
   the dark and paper themes without per-theme overrides. */

/** The Studify mark: a stroke "S" with a gold coin, for study that pays. */
export const BrandMark: React.FC<{ size?: number; className?: string }> = ({ size = 32, className }) => {
  const gradientId = useId();
  return (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8b8ff7" />
        <stop offset="1" stopColor="#5a52d9" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
    <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="#ffffff" strokeOpacity="0.18" />
    <path
      d="M20.5 10.5h-7.25a3 3 0 0 0 0 6h5.5a3 3 0 0 1 0 6H11"
      fill="none"
      stroke="#ffffff"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="23.2" cy="22.5" r="2.4" fill="#f4c35a" />
  </svg>
  );
};

/** A small gold coin glyph used wherever tokens are shown. */
export const CoinIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
    <circle cx="10" cy="10" r="8.25" fill="#f2bf4b" />
    <circle cx="10" cy="10" r="8.25" fill="none" stroke="#c98a12" strokeWidth="1.5" />
    <circle cx="10" cy="10" r="5" fill="none" stroke="#fff3c4" strokeOpacity="0.85" strokeWidth="1.3" />
  </svg>
);

/** Token amount with the coin glyph, in tabular figures. */
export const Tokens: React.FC<{ amount: number; className?: string; iconClassName?: string; signed?: boolean }> = ({
  amount,
  className,
  iconClassName = 'w-3.5 h-3.5',
  signed = false,
}) => (
  <span className={cn('inline-flex items-center gap-1 font-medium tabular-nums', className)}>
    <CoinIcon className={iconClassName} />
    {signed && amount > 0 ? '+' : ''}
    {amount.toLocaleString()}
  </span>
);

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'gold' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-brand-ink hover:bg-brand-hover shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(0_0_0/0.3),0_10px_24px_-14px_var(--brand)]',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-hover',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-hover',
  gold: 'bg-gold text-[#2a1d00] hover:brightness-105 shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]',
  danger: 'bg-danger text-danger-ink hover:brightness-110 shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2.5 rounded-xl',
};

interface ButtonProps extends React.ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  trailingIcon?: LucideIcon;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  trailingIcon: TrailingIcon,
  className,
  children,
  type = 'button',
  ...rest
}) => {
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap transition-[background-color,border-color,filter,transform] duration-150 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={cn(iconSize, 'shrink-0')} aria-hidden="true" />}
      {children}
      {TrailingIcon && <TrailingIcon className={cn(iconSize, 'shrink-0 opacity-80')} aria-hidden="true" />}
    </button>
  );
};

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}

/** Square icon button with an accessible label. */
export const IconButton: React.FC<IconButtonProps> = ({ icon: Icon, label, active, className, type = 'button', ...rest }) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={cn(
      'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors cursor-pointer',
      active ? 'bg-brand-soft text-brand-text' : 'text-ink-muted hover:text-ink hover:bg-surface-hover',
      className,
    )}
    {...rest}
  >
    <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
  </button>
);

/** A bordered content card on the canvas. */
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }> = ({
  className,
  padded = true,
  children,
  ...rest
}) => (
  <div
    className={cn(
      'rounded-2xl border border-line bg-surface shadow-[inset_0_1px_0_rgb(255_255_255/0.035)]',
      padded && 'p-5',
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

type BadgeTone = 'neutral' | 'brand' | 'gold' | 'success' | 'danger' | 'due';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-hover text-ink-muted',
  brand: 'bg-brand-soft text-brand-text',
  gold: 'bg-gold-soft text-gold',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  due: 'bg-due-soft text-due',
};

export const Badge: React.FC<{ tone?: BadgeTone; className?: string; children: React.ReactNode }> = ({
  tone = 'neutral',
  className,
  children,
}) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums',
      BADGE_TONES[tone],
      className,
    )}
  >
    {children}
  </span>
);

/** Thin progress bar; `value` is 0-100. */
export const ProgressBar: React.FC<{ value: number; tone?: 'brand' | 'gold' | 'success'; className?: string; label?: string }> = ({
  value,
  tone = 'brand',
  className,
  label,
}) => {
  const clamped = Math.max(0, Math.min(100, value));
  const fill = tone === 'gold' ? 'bg-gold' : tone === 'success' ? 'bg-success' : 'bg-brand';
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-hover', className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-out', fill)} style={{ width: `${clamped}%` }} />
    </div>
  );
};

/** Circular progress ring; `value` is 0-100. */
export const ProgressRing: React.FC<{
  value: number;
  size?: number;
  stroke?: number;
  tone?: 'brand' | 'success';
  className?: string;
  children?: React.ReactNode;
}> = ({ value, size = 120, stroke = 10, tone = 'brand', className, children }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-hover)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone === 'success' ? 'var(--success)' : 'var(--brand)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
};

/** Section heading with an optional trailing action. */
export const SectionHeader: React.FC<{ title: string; description?: string; action?: React.ReactNode; className?: string }> = ({
  title,
  description,
  action,
  className,
}) => (
  <div className={cn('flex items-end justify-between gap-3', className)}>
    <div className="min-w-0">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {description && <p className="mt-0.5 text-[13px] text-ink-subtle">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const Kbd: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <kbd
    className={cn(
      'inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface-hover px-1 font-mono text-[10.5px] text-ink-subtle',
      className,
    )}
  >
    {children}
  </kbd>
);

/** Accessible on/off switch with a visible label. */
export const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}> = ({ checked, onChange, label, className }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={cn(
      'inline-flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer',
      className,
    )}
  >
    <span
      className={cn(
        'relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-brand' : 'bg-line-strong',
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          'absolute h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[16px]' : 'translate-x-[2px]',
        )}
      />
    </span>
    {label}
  </button>
);
