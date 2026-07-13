import { childColor } from '../lib/familyData.js'

// Single-select filter row: Everyone + one chip per child.
export function ChildFilter({ kids, value, onChange }) {
  if (kids.length === 0) return null
  return (
    <div className="chip-row" role="tablist" aria-label="Filter by child">
      <Chip label="Everyone" active={value === 'all'} onClick={() => onChange('all')} />
      {kids.map((child) => (
        <Chip
          key={child.id}
          label={child.name}
          color={childColor(child)}
          active={value === child.id}
          onClick={() => onChange(child.id)}
        />
      ))}
    </div>
  )
}

// Multi-select used in forms: empty selection means "whole family".
export function ChildMultiSelect({ kids, value, onChange }) {
  if (kids.length === 0) return null
  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  return (
    <div className="chip-row">
      {kids.map((child) => (
        <Chip
          key={child.id}
          label={child.name}
          color={childColor(child)}
          active={value.includes(child.id)}
          onClick={() => toggle(child.id)}
        />
      ))}
    </div>
  )
}

function Chip({ label, color, active, onClick }) {
  return (
    <button
      type="button"
      className={`chip${active ? ' chip-active' : ''}`}
      style={active && color ? { background: color, borderColor: color } : undefined}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

// Small coloured name tags shown on events/documents/photos.
export function ChildTags({ kids, childIds }) {
  const tagged = kids.filter((c) => childIds.includes(c.id))
  if (tagged.length === 0) return null
  return (
    <span className="child-tags">
      {tagged.map((child) => (
        <span key={child.id} className="child-tag" style={{ background: childColor(child) }}>
          {child.name}
        </span>
      ))}
    </span>
  )
}
