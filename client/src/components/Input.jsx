import { useId } from 'react';

const field =
  'w-full bg-surface text-ink placeholder:text-ink-3 border rounded-md ' +
  'transition-colors duration-150 outline-none ' +
  'focus:border-board focus:ring-1 focus:ring-board ' +
  'disabled:bg-paper disabled:text-ink-3 disabled:cursor-not-allowed';

function Shell({ id, label, hint, error, children }) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="block text-[13px] font-medium text-ink mb-1.5"
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-msg`} className="mt-1.5 text-[13px] text-brick">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="mt-1.5 text-[13px] text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export default function Input({
  label,
  hint,
  error,
  className = '',
  id,
  ...props
}) {
  const auto = useId();
  const fieldId = id || auto;
  return (
    <Shell id={fieldId} label={label} hint={hint} error={error}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${fieldId}-msg` : undefined}
        className={`${field} h-11 px-3 text-[15px] ${
          error ? 'border-brick focus:border-brick focus:ring-brick' : 'border-rule-strong'
        } ${className}`}
        {...props}
      />
    </Shell>
  );
}

export function Select({
  label,
  hint,
  error,
  children,
  className = '',
  id,
  ...props
}) {
  const auto = useId();
  const fieldId = id || auto;
  return (
    <Shell id={fieldId} label={label} hint={hint} error={error}>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${fieldId}-msg` : undefined}
        className={`${field} h-11 pl-3 pr-9 text-[15px] appearance-none bg-no-repeat ${
          error ? 'border-brick focus:border-brick focus:ring-brick' : 'border-rule-strong'
        } ${className}`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5 6 6.5l5-5' stroke='%2356605C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
          backgroundPosition: 'right 12px center',
        }}
        {...props}
      >
        {children}
      </select>
    </Shell>
  );
}

export function Textarea({
  label,
  hint,
  error,
  className = '',
  id,
  rows = 3,
  ...props
}) {
  const auto = useId();
  const fieldId = id || auto;
  return (
    <Shell id={fieldId} label={label} hint={hint} error={error}>
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${fieldId}-msg` : undefined}
        className={`${field} px-3 py-2.5 text-[15px] resize-y ${
          error ? 'border-brick focus:border-brick focus:ring-brick' : 'border-rule-strong'
        } ${className}`}
        {...props}
      />
    </Shell>
  );
}
