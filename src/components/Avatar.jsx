import { childColor } from '../lib/familyData.js'
import { useFileUrl } from '../hooks/useFileUrl.js'

// A family member's circle: their photo when they have one (ringed in their
// colour), otherwise their initial on their colour.
export default function Avatar({ child, size = 36 }) {
  const url = useFileUrl(child.avatarFileId || null)

  if (url) {
    return (
      <img
        className="avatar avatar-photo"
        src={url}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, borderColor: childColor(child) }}
      />
    )
  }

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
