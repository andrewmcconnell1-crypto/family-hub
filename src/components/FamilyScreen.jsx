import { useState } from 'react'
import { Copy, Plus, Share2, Users } from 'lucide-react'
import Avatar from './Avatar.jsx'
import Sheet from './Sheet.jsx'
import EmptyState from './EmptyState.jsx'
import { CHILD_COLORS } from '../lib/familyData.js'
import {
  createInvite,
  disbandHousehold,
  friendlyHouseholdError,
  inviteMessage,
  joinHousehold,
  leaveHousehold,
  removeMember,
} from '../lib/household.js'
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
  household,
  onSignIn,
  onSignOut,
}) {
  const [sheet, setSheet] = useState(null) // null | { child? }

  return (
    <div className="screen">
      <header className="screen-header screen-header-row">
        <h1>Family</h1>
        <button type="button" className="primary-button" onClick={() => setSheet({})}>
          <Plus size={18} aria-hidden="true" /> Person
        </button>
      </header>

      {data.children.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No family members yet"
          hint="Add everyone — kids and grown-ups — so events, documents and photos can be tagged to them."
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

      {user && household && <HouseholdSection household={household} />}

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

// Share the hub with a partner: invite (code + share/copy), join by code,
// members list with leave/remove/disband. `household` comes from useHousehold;
// mutations call the RPCs then household.refresh() re-resolves, which in turn
// repoints the data store at the right owner.
function HouseholdSection({ household }) {
  const [inviteCode, setInviteCode] = useState(null)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const run = async (action) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(friendlyHouseholdError(err))
    } finally {
      setBusy(false)
    }
  }

  const invite = () =>
    run(async () => {
      const code = await createInvite()
      setInviteCode(code)
      household.refresh()
    })

  const share = async () => {
    const message = inviteMessage(inviteCode)
    try {
      if (navigator.share) {
        await navigator.share({ text: message })
        return
      }
    } catch {
      // Share sheet dismissed — fall through to clipboard.
    }
    try {
      await navigator.clipboard.writeText(message)
      window.alert('Invite copied — paste it to your partner.')
    } catch {
      // Clipboard unavailable; the code is on screen to read out.
    }
  }

  const join = () =>
    run(async () => {
      await joinHousehold(joinCode)
      setJoinCode('')
      household.refresh()
    })

  if (household.loading) return null

  return (
    <section className="card">
      <h2>Share with your partner</h2>

      {!household.available && (
        <p className="muted">
          One-time server step needed: run <code>supabase/household.sql</code> in the Supabase SQL
          editor, then reload the app.
        </p>
      )}

      {household.available && household.isShared && (
        <>
          <ul className="member-list">
            {household.members.map((member) => (
              <li key={member.memberId} className="member-row">
                <span className="member-main">
                  {member.email || 'Unknown'}
                  {member.memberId === household.currentUserId && ' (you)'}
                  <span className="member-role">{member.role}</span>
                </span>
                {household.role === 'owner' && member.memberId !== household.currentUserId && (
                  <button
                    type="button"
                    className="link-button"
                    disabled={busy}
                    onClick={() =>
                      window.confirm(`Remove ${member.email || 'this member'} from the hub?`) &&
                      run(async () => {
                        await removeMember(member.memberId)
                        household.refresh()
                      })
                    }
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          {household.role === 'owner' ? (
            <button
              type="button"
              className="link-button danger-link"
              disabled={busy}
              onClick={() =>
                window.confirm(
                  'Stop sharing? Everyone goes back to their own separate copy of the hub.',
                ) &&
                run(async () => {
                  await disbandHousehold()
                  household.refresh()
                })
              }
            >
              Stop sharing
            </button>
          ) : (
            <button
              type="button"
              className="link-button danger-link"
              disabled={busy}
              onClick={() =>
                window.confirm('Leave the shared hub? You go back to your own copy.') &&
                run(async () => {
                  await leaveHousehold()
                  household.refresh()
                })
              }
            >
              Leave the shared hub
            </button>
          )}
        </>
      )}

      {household.available && !household.isShared && (
        <>
          <p className="muted">
            Invite your partner so you both see and edit the same hub — each of you signs in with
            your own Google account.
          </p>
          {inviteCode ? (
            <div className="invite-code-row">
              <span className="invite-code">{inviteCode}</span>
              <button type="button" className="primary-button" onClick={share}>
                {navigator.share ? <Share2 size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                Share invite
              </button>
            </div>
          ) : (
            <button type="button" className="primary-button" disabled={busy} onClick={invite}>
              Invite your partner
            </button>
          )}
          <div className="join-row">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Have a code? Enter it"
              maxLength={6}
              aria-label="Invite code"
            />
            <button type="button" className="link-button" disabled={!joinCode.trim() || busy} onClick={join}>
              Join
            </button>
          </div>
        </>
      )}

      {error && <p className="invite-error">{error}</p>}
    </section>
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
    <Sheet title={child ? `Edit ${child.name}` : 'Add a family member'} onClose={onClose}>
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
