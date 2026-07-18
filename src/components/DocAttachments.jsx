import { useState } from 'react'
import { FileText, Paperclip, X } from 'lucide-react'
import { DOC_CATEGORIES } from '../lib/familyData.js'
import { useFileUrl } from '../hooks/useFileUrl.js'

// Attach documents from the hub to an event or to-do. Selected docs are
// listed (tap to open, ✕ to unlink); "Attach document" reveals a picker of
// everything in the Docs tab.
export default function DocAttachments({ docs, value, onChange }) {
  const [picking, setPicking] = useState(false)
  const selected = docs.filter((doc) => value.includes(doc.id))

  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  return (
    <div className="attachments">
      {selected.map((doc) => (
        <AttachedRow key={doc.id} doc={doc} onRemove={() => toggle(doc.id)} />
      ))}
      {docs.length === 0 ? (
        <p className="muted attachments-empty">
          Nothing in the Docs tab yet — add a document there first.
        </p>
      ) : (
        <button type="button" className="link-button" onClick={() => setPicking((p) => !p)}>
          <Paperclip size={14} aria-hidden="true" /> {picking ? 'Done' : 'Attach document'}
        </button>
      )}
      {picking && (
        <ul className="doc-picker">
          {docs.map((doc) => (
            <li key={doc.id}>
              <label className="doc-picker-row">
                <input
                  type="checkbox"
                  checked={value.includes(doc.id)}
                  onChange={() => toggle(doc.id)}
                />
                <span className="doc-picker-title">{doc.title}</span>
                <span className="muted">
                  {DOC_CATEGORIES.find((c) => c.id === doc.category)?.label}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AttachedRow({ doc, onRemove }) {
  const url = useFileUrl(doc.fileId)
  return (
    <div className="attached-row">
      <FileText size={16} aria-hidden="true" />
      {url ? (
        <a
          className="attached-title"
          href={url}
          target="_blank"
          rel="noreferrer"
          download={doc.fileName}
        >
          {doc.title}
        </a>
      ) : (
        <span className="attached-title">{doc.title}</span>
      )}
      <button type="button" className="icon-button" aria-label={`Remove ${doc.title}`} onClick={onRemove}>
        <X size={14} />
      </button>
    </div>
  )
}
