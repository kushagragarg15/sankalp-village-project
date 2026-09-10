const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-md ' +
  'transition-colors duration-150 select-none ' +
  'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none';

const variants = {
  // Board green. The default commitment action.
  primary: 'bg-board text-paper hover:bg-board-600 active:bg-board-700',
  // Sits on paper without competing.
  secondary:
    'bg-surface text-ink border border-rule hover:border-rule-strong hover:bg-paper',
  // Gold means live — only for acting on a session that is running now.
  live: 'bg-gold text-white hover:bg-gold-deep active:bg-gold-deep',
  danger:
    'bg-surface text-brick border border-brick-line hover:bg-brick-wash hover:border-brick',
  ghost: 'text-ink-2 hover:text-ink hover:bg-paper-deep',
  // For use on the inverted board surfaces.
  onBoard:
    'bg-gold-bright text-board hover:bg-white active:bg-white font-semibold',
};

// Touch targets stay at 44px on phones and tighten on pointer devices.
const sizes = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-11 sm:h-9 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
