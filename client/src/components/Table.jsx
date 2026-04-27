export default function Table({ children, className = '' }) {
  return (
    <div className="overflow-x-auto">
      <table className={`min-w-full divide-y divide-zinc-200 ${className}`}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }) {
  return (
    <thead className="bg-zinc-50">
      {children}
    </thead>
  );
}

export function TableBody({ children }) {
  return (
    <tbody className="bg-white divide-y divide-zinc-200">
      {children}
    </tbody>
  );
}

export function TableRow({ children, className = '', ...props }) {
  return (
    <tr className={`hover:bg-zinc-50 transition-colors duration-150 ${className}`} {...props}>
      {children}
    </tr>
  );
}

export function TableHeader({ children, className = '' }) {
  return (
    <th
      scope="col"
      className={`px-3 sm:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider ${className}`}
    >
      {children}
    </th>
  );
}

export function TableCell({ children, className = '' }) {
  return (
    <td className={`px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-zinc-900 ${className}`}>
      {children}
    </td>
  );
}
