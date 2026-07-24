import { useMemo, useState } from 'react'
import { Camera, Crop, Image, Plus } from 'lucide-react'
import ImageCropper from './ImageCropper.jsx'
import PhotoViewer from './PhotoViewer.jsx'
import Sheet from './Sheet.jsx'
import EmptyState from './EmptyState.jsx'
import { ChildFilter, ChildMultiSelect } from './ChildChips.jsx'
import { matchesChild } from '../lib/familyData.js'
import { capturePhoto, isNativeCamera } from '../lib/nativeCamera.js'
import { deleteFile, getFile, putFile, releaseFileUrl } from '../lib/fileStore.js'
import { makeId } from '../utils/id.js'
import { useFileUrl } from '../hooks/useFileUrl.js'

export default function PhotosScreen({ data, addPhotos, updatePhoto, removePhoto }) {
  const [filter, setFilter] = useState('all')
  const [adding, setAdding] = useState(false)
  const [viewing, setViewing] = useState(null) // photo id
  const [editing, setEditing] = useState(null) // photo id
  // Reframing an existing photo: { photo, file } while the cropper is open.
  const [adjusting, setAdjusting] = useState(null)

  const visible = useMemo(
    () => data.photos.filter((photo) => matchesChild(photo, filter)),
    [data.photos, filter],
  )

  // Album-style month sections grouped by when each photo was TAKEN (from its
  // EXIF/file date), newest month first. Photos added before this was tracked
  // fall back to their added date so they still land in a sensible month.
  const months = useMemo(() => {
    const dated = visible
      .map((photo) => ({ photo, when: photo.takenAt || photo.addedAt || '' }))
      .sort((a, b) => b.when.localeCompare(a.when)) // newest first; undated sorts last
    const map = new Map()
    for (const { photo, when } of dated) {
      const date = when ? new Date(when) : null
      const valid = date && !Number.isNaN(date.getTime())
      const key = valid ? `${date.getFullYear()}-${date.getMonth()}` : 'earlier'
      if (!map.has(key)) {
        map.set(key, {
          label: valid
            ? date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
            : 'Earlier',
          photos: [],
        })
      }
      map.get(key).photos.push(photo)
    }
    return [...map.values()]
  }, [visible])
  const viewingPhoto = viewing ? data.photos.find((p) => p.id === viewing) : null
  const editingPhoto = editing ? data.photos.find((p) => p.id === editing) : null

  return (
    <div className="screen">
      <header className="screen-header screen-header-row planner-header">
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
        months.map((month) => (
          <section key={month.label} className="photo-month">
            <h2>{month.label}</h2>
            <div className="photo-grid">
              {month.photos.map((photo) => (
                <PhotoCell key={photo.id} photo={photo} onOpen={() => setViewing(photo.id)} />
              ))}
            </div>
          </section>
        ))
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
          onEdit={() => setEditing(viewingPhoto.id)}
          onDelete={() => {
            removePhoto(viewingPhoto.id)
            setViewing(null)
          }}
          onClose={() => setViewing(null)}
        />
      )}

      {editingPhoto && (
        <EditPhotoSheet
          kids={data.children}
          photo={editingPhoto}
          onSave={(fields) => {
            updatePhoto(editingPhoto.id, fields)
            setEditing(null)
          }}
          onAdjust={async () => {
            const blob = await getFile(editingPhoto.fileId).catch(() => null)
            if (!blob) {
              window.alert("Couldn't load the photo to adjust it — check your connection.")
              return
            }
            setAdjusting({ photo: editingPhoto, file: blob })
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {adjusting && (
        <ImageCropper
          file={adjusting.file}
          round={false}
          output={2000}
          onCancel={() => setAdjusting(null)}
          onUse={async (blob) => {
            try {
              const fileId = makeId('file')
              await putFile(fileId, blob)
              releaseFileUrl(adjusting.photo.fileId)
              deleteFile(adjusting.photo.fileId).catch(() => {})
              updatePhoto(adjusting.photo.id, { fileId, fileType: blob.type })
              setAdjusting(null)
            } catch (error) {
              console.error('Saving reframed photo failed', error)
              window.alert("Couldn't save the adjusted photo — check your connection and try again.")
            }
          }}
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

// Edit a photo's caption/tags, or reframe (crop + zoom) the image itself.
function EditPhotoSheet({ kids, photo, onSave, onAdjust, onClose }) {
  const [caption, setCaption] = useState(photo.caption || '')
  const [childIds, setChildIds] = useState(photo.childIds || [])
  const previewUrl = useFileUrl(photo.fileId)

  const submit = (e) => {
    e.preventDefault()
    onSave({ caption: caption.trim(), childIds })
  }

  return (
    <Sheet title="Edit photo" onClose={onClose}>
      <div className="edit-photo-preview">
        {previewUrl && <img src={previewUrl} alt="" />}
        <button type="button" className="primary-button" onClick={onAdjust}>
          <Crop size={16} aria-hidden="true" /> Crop & zoom
        </button>
      </div>
      <form className="form" onSubmit={submit}>
        <label>
          Caption
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Sports day 2026" autoFocus />
        </label>
        {kids.length > 0 && (
          <div className="form-field">
            <span className="form-label">Who's in it? <span className="label-hint">none = whole family</span></span>
            <ChildMultiSelect kids={kids} value={childIds} onChange={setChildIds} />
          </div>
        )}
        <div className="form-actions">
          <button type="submit" className="primary-button">
            Save
          </button>
        </div>
      </form>
    </Sheet>
  )
}

function AddPhotosSheet({ kids, onAdd, onClose }) {
  const [files, setFiles] = useState([])
  const [childIds, setChildIds] = useState([])
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)
  const [cropFile, setCropFile] = useState(null) // single-photo reframe before adding

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
          {isNativeCamera() && (
            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                try {
                  const photo = await capturePhoto()
                  if (photo) setFiles([photo])
                } catch (error) {
                  console.error('Camera capture failed', error)
                  window.alert("Couldn't open the camera — try again.")
                }
              }}
            >
              <Camera size={16} aria-hidden="true" /> Take a photo
            </button>
          )}
          {files.length > 1 && <span className="muted">{files.length} photos selected</span>}
          {files.length === 1 && (
            <button type="button" className="secondary-button" onClick={() => setCropFile(files[0])}>
              <Crop size={16} aria-hidden="true" /> Crop & zoom before adding
            </button>
          )}
        </div>
        {kids.length > 0 && (
          <div className="form-field">
            <span className="form-label">Who's in them? <span className="label-hint">none = whole family</span></span>
            <ChildMultiSelect kids={kids} value={childIds} onChange={setChildIds} />
          </div>
        )}
        <label>
          Caption
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Sports day 2026" />
        </label>
        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={files.length === 0 || saving}>
            {saving ? 'Saving…' : files.length > 1 ? `Add ${files.length} photos` : 'Add photo'}
          </button>
        </div>
      </form>
      {cropFile && (
        <ImageCropper
          file={cropFile}
          round={false}
          output={2000}
          onCancel={() => setCropFile(null)}
          onUse={(blob) => {
            setFiles([blob])
            setCropFile(null)
          }}
        />
      )}
    </Sheet>
  )
}
