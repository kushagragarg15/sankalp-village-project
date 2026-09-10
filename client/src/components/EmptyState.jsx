// An empty screen is an invitation to act, so the action comes with it.
export default function EmptyState({ title, description, action, className = '' }) {
  return (
    <div
      className={`bg-surface border border-dashed border-rule-strong rounded-lg px-6 py-12 text-center ${className}`}
    >
      <h3 className="type-title text-[15px] text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-ink-2 max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
