export default function EmptyState({ icon: Icon, title, hint, compact = false }) {
  return (
    <div className={`empty-state${compact ? ' empty-state-compact' : ''}`}>
      {Icon && <Icon size={compact ? 18 : 32} aria-hidden="true" />}
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
    </div>
  )
}
