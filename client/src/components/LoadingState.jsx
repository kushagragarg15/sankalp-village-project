// A ruled bar, matching the register language used elsewhere. The segment
// travels the track rather than fading in place: a bar that only pulses reads
// as a decoration that happens to be on the screen, not as work in progress.
export default function LoadingState({ label = 'Loading' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-20 gap-3"
    >
      <div className="h-[3px] w-32 rounded-full bg-rule overflow-hidden">
        <div className="h-full w-1/3 rounded-full bg-board animate-rule-sweep" />
      </div>
      <p className="text-[13px] text-ink-2">{label}</p>
    </div>
  );
}
