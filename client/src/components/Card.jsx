// Flat and ruled — the only elevated surface in the app is a modal.
export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-surface border border-rule rounded-lg ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-rule ${className}`}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }) {
  return <div className={`px-4 sm:px-5 py-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }) {
  return (
    <h2 className={`type-title text-[15px] text-ink ${className}`}>{children}</h2>
  );
}
