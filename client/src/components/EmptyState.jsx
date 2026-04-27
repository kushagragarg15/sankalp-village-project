export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="text-center py-12">
      {icon && (
        <div className="mx-auto h-12 w-12 text-zinc-400 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-zinc-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-zinc-500 mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
