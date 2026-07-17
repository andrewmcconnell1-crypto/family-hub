import { useMemo } from 'react'
import { useFileUrl } from '../hooks/useFileUrl.js'
import { todayKey } from '../utils/dateUtils.js'

// A family photo as the app backdrop: blurred and washed with the theme
// background so content stays readable. The pick is seeded by the date, so
// it's a stable "photo of the day" that changes tomorrow.
export default function Wallpaper({ photos, enabled }) {
  const photo = useMemo(() => {
    if (!enabled || photos.length === 0) return null
    let hash = 0
    for (const ch of todayKey()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
    return photos[hash % photos.length]
  }, [photos, enabled])

  const url = useFileUrl(photo?.fileId || null)
  if (!url) return null

  return (
    <div className="wallpaper" aria-hidden="true">
      <img src={url} alt="" />
    </div>
  )
}
