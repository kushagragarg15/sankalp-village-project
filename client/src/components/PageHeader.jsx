export default function PageHeader({ title, lede, actions, children }) {
  return (
    <header className="mb-6 sm:mb-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          {children}
          <h1 className="type-display text-[26px] sm:text-[34px] text-ink">
            {title}
          </h1>
          {lede && (
            <p className="mt-1.5 text-sm text-ink-2 max-w-[62ch]">{lede}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
      <div className="mt-5 h-px bg-rule" />
    </header>
  );
}
