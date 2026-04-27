export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-white border border-zinc-200 rounded-lg shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`px-4 sm:px-6 py-4 border-b border-zinc-200 ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }) {
  return (
    <div className={`px-4 sm:px-6 py-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`text-base sm:text-lg font-semibold text-zinc-900 ${className}`}>
      {children}
    </h3>
  );
}
