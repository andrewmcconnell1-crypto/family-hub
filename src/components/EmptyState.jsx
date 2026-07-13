export default function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={32} aria-hidden="true" />}
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
    </div>
  )
}
