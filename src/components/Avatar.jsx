import { childColor } from '../lib/familyData.js'

export default function Avatar({ child, size = 36 }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.44, background: childColor(child) }}
      aria-hidden="true"
    >
      {(child.name || '?').trim().charAt(0).toUpperCase()}
    </span>
  )
}
