// One ruled band divided by hairlines — not a row of identical cards.
export default function StatStrip({ items, className = '' }) {
  return (
    <dl
      className={`bg-surface border border-rule rounded-lg grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-rule overflow-hidden ${className}`}
    >
      {items.map((item) => (
        <div key={item.label} className="px-4 py-4 sm:px-5 sm:py-5">
          <dt className="text-[13px] text-ink-2">{item.label}</dt>
          <dd
            className={`type-display mt-1 text-[28px] sm:text-[32px] ${
              item.accent ? 'text-gold-deep' : 'text-ink'
            }`}
          >
            {item.value}
          </dd>
          {item.note && (
            <p className="mt-0.5 text-[13px] text-ink-2">{item.note}</p>
          )}
        </div>
      ))}
    </dl>
  );
}
