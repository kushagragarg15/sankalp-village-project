// A ruled bar that fills, matching the register language used elsewhere.
export default function LoadingState({ label = 'Loading' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-20 gap-3"
    >
      <div className="h-[3px] w-32 rounded-full bg-rule overflow-hidden">
        <div className="h-full w-1/3 rounded-full bg-board animate-rule-pulse" />
      </div>
      <p className="text-[13px] text-ink-2">{label}</p>
    </div>
  );
}
