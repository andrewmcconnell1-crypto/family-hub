import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import Avatar from './Avatar.jsx'
import Sheet from './Sheet.jsx'
import EmptyState from './EmptyState.jsx'
import { CHILD_COLORS } from '../lib/familyData.js'
import { ageFromDob, formatDateKey } from '../utils/dateUtils.js'

const SYNC_LABELS = {
  local: { dot: 'sync-dot-local', text: 'On this device only' },
  syncing: { dot: 'sync-dot-syncing', text: 'Syncing…' },
  synced: { dot: 'sync-dot-synced', text: 'Synced to the cloud' },
  error: { dot: 'sync-dot-error', text: 'Sync problem — changes are safe on this device' },
}

export default function FamilyScreen({
  data,
  addChild,
  updateChild,
  removeChild,
  syncState,
  user,
  onSignIn,
  onSignOut,
}) {
  const [sheet, setSheet] = useState(null) // null | { child? }

  return (
    <div className="screen">
      <header className="screen-header screen-header-row">
        <h1>Family</h1>
        <button type="button" className="primary-button" onClick={() => setSheet({})}>
          <Plus size={18} aria-hidden="true" /> Child
        </button>
      </header>

      {data.children.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No children added yet"
          hint="Add each child so events, documents and photos can be tagged to them."
        />
      ) : (
        <section className="card">
          <ul className="kid-list">
            {data.children.map((child) => (
              <li key={child.id}>
                <button type="button" className="kid-row" onClick={() => setSheet({ child })}>
                  <Avatar child={child} size={44} />
                  <span className="kid-main">
                    <span className="kid-name">{child.name}</span>
                    {child.dob && (
                      <span className="kid-meta">
                        {formatDateKey(child.dob, { long: true })}
                        {ageFromDob(child.dob) != null && ` · ${ageFromDob(child.dob)}`}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Account & sync</h2>
        <p className="sync-status">
          <span className={`sync-dot ${SYNC_LABELS[syncState].dot}`} aria-hidden="true" />
          {SYNC_LABELS[syncState].text}
        </p>
        {user ? (
          <div className="account-row">
            <span className="muted">{user.email}</span>
            <button type="button" className="link-button" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        ) : (
          <>
            <p className="muted">
              Everything is stored privately on this device. Sign in to back it up to the cloud
              and see it on all your devices.
            </p>
            <button type="button" className="primary-button" onClick={onSignIn}>
              Sign in with Google
            </button>
          </>
        )}
      </section>

      {sheet && (
        <ChildSheet
          child={sheet.child}
          onSave={(fields) => {
            if (sheet.child) updateChild(sheet.child.id, fields)
            else addChild(fields)
            setSheet(null)
          }}
          onDelete={
            sheet.child
              ? () => {
                  removeChild(sheet.child.id)
                  setSheet(null)
                }
              : null
          }
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}

function ChildSheet({ child, onSave, onDelete, onClose }) {
  const [name, setName] = useState(child?.name || '')
  const [dob, setDob] = useState(child?.dob || '')
  const [colorId, setColorId] = useState(child?.colorId || 'meadow')

  const submit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), dob, colorId })
  }

  return (
    <Sheet title={child ? `Edit ${child.name}` : 'Add a child'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </label>
        <label>
          Date of birth <span className="muted">(optional)</span>
          <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </label>
        <div className="form-field">
          <span className="form-label">Colour</span>
          <div className="chip-row">
            {CHILD_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                className={`swatch${colorId === color.id ? ' swatch-active' : ''}`}
                style={{ background: color.value }}
                aria-label={color.id}
                aria-pressed={colorId === color.id}
                onClick={() => setColorId(color.id)}
              />
            ))}
          </div>
        </div>
        <div className="form-actions">
          {onDelete && (
            <button
              type="button"
              className="danger-button"
              onClick={() => {
                if (
                  window.confirm(
                    `Remove ${child.name}? Their events, documents and photos stay, just untagged.`,
                  )
                )
                  onDelete()
              }}
            >
              Remove
            </button>
          )}
          <button type="submit" className="primary-button">
            Save
          </button>
        </div>
      </form>
    </Sheet>
  )
}
