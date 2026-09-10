// Chart parameters for this design system. The two categorical hues are the
// UI teal and club gold, saturated enough to hold as marks and validated for
// colour-vision deficiency (worst adjacent pair ΔE 10.4 protan / 21.1 normal).
export const SERIES = {
  primary: '#00846E',
  secondary: '#BF7A0B',
};

export const AXIS = '#56605C';
export const GRID = '#DCDFD8';

export function ChartFrame({ title, note, children, empty, emptyNote }) {
  return (
    <section className="rounded-lg border border-rule bg-surface">
      <header className="border-b border-rule px-5 py-3.5">
        <h2 className="type-title text-[15px] text-ink">{title}</h2>
        {note && <p className="mt-0.5 text-[13px] text-ink-2">{note}</p>}
      </header>
      <div className="px-2 py-4 sm:px-4">
        {empty ? (
          <p className="px-3 py-12 text-center text-sm text-ink-2">{emptyNote}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

// Values and labels wear text tokens; the swatch beside them carries identity.
export function ChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-rule bg-surface px-3 py-2 shadow-[0_6px_20px_-8px_rgba(23,33,31,0.35)]">
      <p className="text-[13px] font-medium text-ink">{label}</p>
      <ul className="mt-1 space-y-0.5">
        {payload.map((entry) => (
          <li key={entry.dataKey} className="flex items-center gap-2 text-[13px]">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-[1px]"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-ink-2">{entry.name}</span>
            <span className="ml-auto pl-3 text-ink tabular-nums">
              {entry.value}
              {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Legend({ items }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-3 pb-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-[13px] text-ink-2">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-[1px]"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
