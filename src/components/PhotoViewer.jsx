import { Pencil, Trash2, X } from 'lucide-react'
import { ChildTags } from './ChildChips.jsx'
import { useFileUrl } from '../hooks/useFileUrl.js'

// Full-screen photo lightbox. Edit/delete are optional so lighter surfaces
// (e.g. the Home "Recent photos" strip) can open a photo to view it without
// offering the management actions.
export default function PhotoViewer({ photo, kids = [], onEdit, onDelete, onClose }) {
  const url = useFileUrl(photo.fileId)
  return (
    <div className="viewer-backdrop" onClick={onClose}>
      <div className="viewer" role="dialog" aria-modal="true" aria-label="Photo" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-actions">
          {onEdit && (
            <button
              type="button"
              className="icon-button viewer-button"
              aria-label="Edit photo details"
              onClick={onEdit}
            >
              <Pencil size={20} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="icon-button viewer-button"
              aria-label="Delete photo"
              onClick={onDelete}
            >
              <Trash2 size={20} />
            </button>
          )}
          <button type="button" className="icon-button viewer-button" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {url && <img src={url} alt={photo.caption || ''} />}
        {(photo.caption || photo.childIds.length > 0) && (
          <div className="viewer-caption">
            {photo.caption && <span>{photo.caption}</span>}
            <ChildTags kids={kids} childIds={photo.childIds} />
          </div>
        )}
      </div>
    </div>
  )
}
