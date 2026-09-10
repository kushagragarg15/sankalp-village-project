export default function Table({ children, minWidth = 640, className = '' }) {
  return (
    <div className="overflow-x-auto">
      <table
        className={`w-full text-left border-collapse ${className}`}
        style={{ minWidth }}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }) {
  return <thead className="bg-paper">{children}</thead>;
}

export function TableBody({ children }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({ children, className = '', ...props }) {
  return (
    <tr
      className={`border-t border-rule hover:bg-paper transition-colors duration-100 ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHeader({ children, className = '' }) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 text-[13px] font-medium text-ink-2 whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

export function TableCell({ children, className = '' }) {
  return (
    <td className={`px-4 py-3 text-sm text-ink align-middle ${className}`}>
      {children}
    </td>
  );
}
