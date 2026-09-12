const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-md ' +
  'transition-colors duration-150 select-none';

// Off: dimmed and out of the way.
const idle =
  'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none';

// Working: not off. A button mid-request used to take the same 45% dim as a
// button you are not allowed to press, which is why waiting felt like nothing
// was happening — the one element that should look most alive looked switched
// off. It keeps its colour and carries the work on its bottom edge instead.
const busy = 'relative overflow-hidden cursor-progress pointer-events-none';

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

// The work itself, in the register's own vocabulary: a rule that fills, the
// same language as the depleting rule under a live session code.
function WorkRule() {
  return (
    <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px]">
      <span className="absolute inset-0 bg-current opacity-[0.18]" />
      <span className="absolute inset-0 origin-left bg-current animate-work-fill" />
    </span>
  );
}

function WorkDots() {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-[3px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-[3px] w-[3px] rounded-full bg-current animate-work-dot"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  loading = false,
  disabled = false,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${loading ? busy : idle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
      {loading && <WorkDots />}
      {loading && <WorkRule />}
    </button>
  );
}
