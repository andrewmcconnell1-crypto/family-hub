import { useEffect, useState } from 'react'
import { getFileUrl } from '../lib/fileStore.js'

// Resolve a stored file to a displayable object URL. Null while loading or
// if the blob is missing. The result is keyed by fileId so a stale URL is
// never shown while a newly requested file loads.
export function useFileUrl(fileId) {
  const [resolved, setResolved] = useState({ fileId: null, url: null })

  useEffect(() => {
    if (!fileId) return undefined
    let active = true
    getFileUrl(fileId)
      .then((url) => active && setResolved({ fileId, url }))
      .catch(() => active && setResolved({ fileId, url: null }))
    return () => {
      active = false
    }
  }, [fileId])

  return resolved.fileId === fileId ? resolved.url : null
}
