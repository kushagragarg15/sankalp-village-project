// A vertical rule with a tick at each entry. Sessions genuinely are a
// sequence in time, so the structure says so.
export default function Spine({ children, className = '' }) {
  return <ol className={`spine ${className}`}>{children}</ol>;
}

export function SpineEntry({ state = 'upcoming', children, className = '' }) {
  return (
    <li
      data-state={state}
      className={`spine-tick relative py-3 ${className}`}
    >
      {children}
    </li>
  );
}
