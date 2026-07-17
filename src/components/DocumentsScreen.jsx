import { useMemo, useRef, useState } from 'react'
import { FileText, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import Sheet from './Sheet.jsx'
import EmptyState from './EmptyState.jsx'
import { ChildFilter, ChildMultiSelect, ChildTags } from './ChildChips.jsx'
import { DOC_CATEGORIES, matchesChild } from '../lib/familyData.js'
import { addDays, formatDateKey, toDateKey, todayKey } from '../utils/dateUtils.js'
import { useFileUrl } from '../hooks/useFileUrl.js'

export default function DocumentsScreen({ data, addDocument, updateDocument, removeDocument }) {
  const [filter, setFilter] = useState('all')
  const [sheet, setSheet] = useState(null) // null | { doc? }

  const groups = useMemo(() => {
    const visible = data.documents.filter((doc) => matchesChild(doc, filter))
    return DOC_CATEGORIES.map((category) => ({
      category,
      docs: visible.filter((doc) => doc.category === category.id),
    })).filter((group) => group.docs.length > 0)
  }, [data.documents, filter])

  return (
    <div className="screen">
      <header className="screen-header screen-header-row">
        <h1>Documents</h1>
        <button type="button" className="primary-button" onClick={() => setSheet({})}>
          <Plus size={18} aria-hidden="true" /> Add
        </button>
      </header>

      <ChildFilter kids={data.children} value={filter} onChange={setFilter} />

      {groups.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No documents yet"
          hint="Passports, birth certificates, school letters, medical records — keep them all here."
        />
      ) : (
        groups.map(({ category, docs }) => (
          <section key={category.id} className="card">
            <h2>{category.label}</h2>
            <ul className="doc-list">
              {docs.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  kids={data.children}
                  onEdit={() => setSheet({ doc })}
                  onRemove={() => removeDocument(doc.id)}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      {sheet && (
        <DocumentSheet
          kids={data.children}
          doc={sheet.doc}
          onSave={async (fields) => {
            if (sheet.doc) updateDocument(sheet.doc.id, fields)
            else await addDocument(fields)
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function expiryLabel(doc) {
  if (!doc.expiryDate) return null
  const today = todayKey()
  if (doc.expiryDate < today) {
    return { text: `expired ${formatDateKey(doc.expiryDate)}`, urgent: true }
  }
  const soon = doc.expiryDate <= addDays(today, 30)
  return {
    text: `expires ${formatDateKey(doc.expiryDate, { long: !soon })}`,
    urgent: soon,
  }
}

function DocRow({ doc, kids, onEdit, onRemove }) {
  const url = useFileUrl(doc.fileId)
  const expiry = expiryLabel(doc)
  return (
    <li className="doc-row">
      <FileText size={20} className="doc-icon" aria-hidden="true" />
      <div className="doc-main">
        {url ? (
          <a className="doc-title" href={url} target="_blank" rel="noreferrer" download={doc.fileName}>
            {doc.title}
          </a>
        ) : (
          <span className="doc-title">{doc.title}</span>
        )}
        <span className="doc-meta">
          {doc.addedAt && formatDateKey(toDateKey(new Date(doc.addedAt)))}
          {doc.size ? ` · ${formatSize(doc.size)}` : ''}
          {expiry && (
            <span className={expiry.urgent ? 'doc-expiry-urgent' : undefined}> · {expiry.text}</span>
          )}
          <ChildTags kids={kids} childIds={doc.childIds} />
        </span>
        {doc.notes && <span className="doc-notes">{doc.notes}</span>}
      </div>
      <button type="button" className="icon-button" aria-label={`Edit ${doc.title}`} onClick={onEdit}>
        <Pencil size={18} />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={`Delete ${doc.title}`}
        onClick={() => {
          if (window.confirm(`Delete “${doc.title}”? This can't be undone.`)) onRemove()
        }}
      >
        <Trash2 size={18} />
      </button>
    </li>
  )
}

// Add (with file) or edit (details only — the file itself doesn't change).
function DocumentSheet({ kids, doc, onSave, onClose }) {
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState(doc?.title || '')
  const [category, setCategory] = useState(doc?.category || 'other')
  const [childIds, setChildIds] = useState(doc?.childIds || [])
  const [notes, setNotes] = useState(doc?.notes || '')
  const [expiryDate, setExpiryDate] = useState(doc?.expiryDate || '')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if ((!doc && !file) || saving) return
    setSaving(true)
    try {
      await onSave({
        ...(doc ? {} : { file }),
        title: title.trim() || (file ? file.name : doc.title),
        category,
        childIds,
        notes: notes.trim(),
        expiryDate,
      })
    } catch (error) {
      console.error('Saving document failed', error)
      window.alert("Couldn't save the document — check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title={doc ? 'Edit document' : 'Add document'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {!doc && (
          <div className="form-field">
            <input
              ref={fileRef}
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] || null
                setFile(f)
                if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''))
              }}
            />
          </div>
        )}
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Birth certificate" />
        </label>
        <div className="form-row">
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {DOC_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Expires
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </label>
        </div>
        {kids.length > 0 && (
          <div className="form-field">
            <span className="form-label">Belongs to <span className="label-hint">none = whole family</span></span>
            <ChildMultiSelect kids={kids} value={childIds} onChange={setChildIds} />
          </div>
        )}
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </label>
        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={(!doc && !file) || saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
