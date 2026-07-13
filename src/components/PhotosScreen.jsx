import { useMemo, useState } from 'react'
import { Image, Plus, Trash2, X } from 'lucide-react'
import Sheet from './Sheet.jsx'
import EmptyState from './EmptyState.jsx'
import { ChildFilter, ChildMultiSelect, ChildTags } from './ChildChips.jsx'
import { matchesChild } from '../lib/familyData.js'
import { useFileUrl } from '../hooks/useFileUrl.js'

export default function PhotosScreen({ data, addPhotos, removePhoto }) {
  const [filter, setFilter] = useState('all')
  const [adding, setAdding] = useState(false)
  const [viewing, setViewing] = useState(null) // photo id

  const visible = useMemo(
    () => data.photos.filter((photo) => matchesChild(photo, filter)),
    [data.photos, filter],
  )
  const viewingPhoto = viewing ? data.photos.find((p) => p.id === viewing) : null

  return (
    <div className="screen">
      <header className="screen-header screen-header-row">
        <h1>Photos</h1>
        <button type="button" className="primary-button" onClick={() => setAdding(true)}>
          <Plus size={18} aria-hidden="true" /> Add
        </button>
      </header>

      <ChildFilter kids={data.children} value={filter} onChange={setFilter} />

      {visible.length === 0 ? (
        <EmptyState
          icon={Image}
          title="No photos yet"
          hint="First days of school, birthdays, holidays — build the family album."
        />
      ) : (
        <div className="photo-grid">
          {visible.map((photo) => (
            <PhotoCell key={photo.id} photo={photo} onOpen={() => setViewing(photo.id)} />
          ))}
        </div>
      )}

      {adding && (
        <AddPhotosSheet
          kids={data.children}
          onAdd={async (fields) => {
            await addPhotos(fields)
            setAdding(false)
          }}
          onClose={() => setAdding(false)}
        />
      )}

      {viewingPhoto && (
        <PhotoViewer
          photo={viewingPhoto}
          kids={data.children}
          onDelete={() => {
            removePhoto(viewingPhoto.id)
            setViewing(null)
          }}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}

function PhotoCell({ photo, onOpen }) {
  const url = useFileUrl(photo.fileId)
  return (
    <button type="button" className="photo-cell" onClick={onOpen} aria-label={photo.caption || 'View photo'}>
      {url ? <img src={url} alt={photo.caption || ''} loading="lazy" /> : <span className="photo-placeholder" />}
    </button>
  )
}

function PhotoViewer({ photo, kids, onDelete, onClose }) {
  const url = useFileUrl(photo.fileId)
  return (
    <div className="viewer-backdrop" onClick={onClose}>
      <div className="viewer" role="dialog" aria-modal="true" aria-label="Photo" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-actions">
          <button
            type="button"
            className="icon-button viewer-button"
            aria-label="Delete photo"
            onClick={() => {
              if (window.confirm('Delete this photo? This can’t be undone.')) onDelete()
            }}
          >
            <Trash2 size={20} />
          </button>
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

function AddPhotosSheet({ kids, onAdd, onClose }) {
  const [files, setFiles] = useState([])
  const [childIds, setChildIds] = useState([])
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (files.length === 0 || saving) return
    setSaving(true)
    try {
      await onAdd({ files, childIds, caption: caption.trim() })
    } catch (error) {
      console.error('Saving photos failed', error)
      window.alert("Couldn't save the photos — check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Add photos" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-field">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          {files.length > 1 && <span className="muted">{files.length} photos selected</span>}
        </div>
        {kids.length > 0 && (
          <div className="form-field">
            <span className="form-label">Who's in them? <span className="muted">(none = whole family)</span></span>
            <ChildMultiSelect kids={kids} value={childIds} onChange={setChildIds} />
          </div>
        )}
        <label>
          Caption <span className="muted">(optional)</span>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Sports day 2026" />
        </label>
        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={files.length === 0 || saving}>
            {saving ? 'Saving…' : files.length > 1 ? `Add ${files.length} photos` : 'Add photo'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
