const variants = {
  default: 'bg-paper-deep text-ink-2 border-rule-strong',
  live: 'bg-gold-wash text-gold-deep border-gold-line',
  recorded: 'bg-teal-wash text-teal border-teal-line',
  blocked: 'bg-brick-wash text-brick border-brick-line',
  quiet: 'bg-surface text-ink-2 border-rule',
};

// Legacy pages still name states the old way.
const aliases = { success: 'recorded', warning: 'live', danger: 'blocked', info: 'quiet', primary: 'default' };

export default function Badge({
  children,
  variant = 'default',
  className = '',
}) {
  const tone = variants[variant] ? variant : aliases[variant] || 'default';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${variants[tone]} ${className}`}
    >
      {tone === 'live' && (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-gold animate-rule-pulse"
        />
      )}
      {children}
    </span>
  );
}
