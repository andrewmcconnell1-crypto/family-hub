import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Plus, Share2, Users } from 'lucide-react'
import Avatar from './Avatar.jsx'
import CalendarFeedCard from './CalendarFeedCard.jsx'
import ExternalCalendarsCard from './ExternalCalendarsCard.jsx'
import ImageCropper from './ImageCropper.jsx'
import RemindersCard from './RemindersCard.jsx'
import Sheet from './Sheet.jsx'
import EmptyState from './EmptyState.jsx'
import { CHILD_COLORS, childColor } from '../lib/familyData.js'
import { buildZip, extensionFor, safeFileName } from '../lib/backupZip.js'
import { deleteFile, getFile, putFile, releaseFileUrl } from '../lib/fileStore.js'
import { useFileUrl } from '../hooks/useFileUrl.js'
import { makeId } from '../utils/id.js'
import {
  createInvite,
  disbandHousehold,
  friendlyHouseholdError,
  inviteMessage,
  joinHousehold,
  leaveHousehold,
  removeMember,
} from '../lib/household.js'
import { ageFromDob, formatDateKey, todayKey } from '../utils/dateUtils.js'

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
  addExternalCalendar,
  removeExternalCalendar,
  externalCalendars,
  syncState,
  user,
  household,
  theme,
  onThemeChange,
  wallpaper,
  onWallpaperChange,
  onSignIn,
  onSignOut,
}) {
  const [sheet, setSheet] = useState(null) // null | { child? }
  const [backingUp, setBackingUp] = useState(false)

  // Bundle everything — data as JSON plus every document, photo and avatar
  // blob — into a zip the user can archive anywhere.
  const exportBackup = async () => {
    if (backingUp) return
    setBackingUp(true)
    try {
      const files = [{ name: 'treehouse/data.json', data: JSON.stringify(data, null, 2) }]
      for (const doc of data.documents) {
        const blob = await getFile(doc.fileId).catch(() => null)
        if (blob) {
          const name = safeFileName(doc.title, doc.id)
          files.push({
            name: `treehouse/documents/${name}-${doc.id}${extensionFor(doc.fileName, blob.type)}`,
            data: blob,
          })
        }
      }
      for (const photo of data.photos) {
        const blob = await getFile(photo.fileId).catch(() => null)
        if (blob) {
          files.push({
            name: `treehouse/photos/${photo.id}${extensionFor('', blob.type) || '.jpg'}`,
            data: blob,
          })
        }
      }
      for (const member of data.children) {
        if (!member.avatarFileId) continue
        const blob = await getFile(member.avatarFileId).catch(() => null)
        if (blob) {
          files.push({
            name: `treehouse/avatars/${safeFileName(member.name, member.id)}${extensionFor('', blob.type) || '.jpg'}`,
            data: blob,
          })
        }
      }
      const zip = await buildZip(files)
      const url = URL.createObjectURL(zip)
      const link = document.createElement('a')
      link.href = url
      link.download = `treehouse-backup-${todayKey()}.zip`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch (error) {
      console.error('Backup failed', error)
      window.alert("Couldn't build the backup — check your connection and try again.")
    } finally {
      setBackingUp(false)
    }
  }

  return (
    <div className="screen">
      <header className="screen-header screen-header-row planner-header">
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

      {user && <RemindersCard user={user} />}
      {user && <CalendarFeedCard user={user} />}

      <ExternalCalendarsCard
        calendars={data.externalCalendars}
        feed={externalCalendars}
        addExternalCalendar={addExternalCalendar}
        removeExternalCalendar={removeExternalCalendar}
        signedIn={Boolean(user)}
      />

      <section className="card">
        <h2>Appearance</h2>
        <div className="chip-row">
          {[
            { id: 'system', label: 'Match device' },
            { id: 'light', label: 'Light' },
            { id: 'dark', label: 'Dark' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              className={`chip${theme === option.id ? ' chip-active' : ''}`}
              aria-pressed={theme === option.id}
              onClick={() => onThemeChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="appearance-label">
          Photo wallpaper <span className="muted">— one of your photos, softly, behind the app; a new one each day</span>
        </p>
        <div className="chip-row">
          {[
            { id: true, label: 'On' },
            { id: false, label: 'Off' },
          ].map((option) => (
            <button
              key={String(option.id)}
              type="button"
              className={`chip${wallpaper === option.id ? ' chip-active' : ''}`}
              aria-pressed={wallpaper === option.id}
              onClick={() => onWallpaperChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p className="muted">
          Download everything — data, documents, photos and avatars — as a zip you can keep
          anywhere safe.
        </p>
        <button type="button" className="primary-button" disabled={backingUp} onClick={exportBackup}>
          {backingUp ? 'Preparing…' : 'Download backup'}
        </button>
      </section>

      {sheet && (
        <ChildSheet
          child={sheet.child}
          onSave={async ({ avatar, ...fields }) => {
            try {
              let avatarFileId = sheet.child?.avatarFileId || ''
              // A new photo or an explicit removal replaces the old file.
              if (avatarFileId && (avatar.file || avatar.remove)) {
                releaseFileUrl(avatarFileId)
                deleteFile(avatarFileId).catch(() => {})
                avatarFileId = ''
              }
              if (avatar.file) {
                // Already cropped + downscaled by ImageCropper.
                avatarFileId = makeId('file')
                await putFile(avatarFileId, avatar.file)
              }
              if (sheet.child) updateChild(sheet.child.id, { ...fields, avatarFileId })
              else addChild({ ...fields, avatarFileId })
              setSheet(null)
            } catch (error) {
              console.error('Saving member photo failed', error)
              window.alert("Couldn't save the photo — check your connection and try again.")
            }
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
  // Photo choice: a freshly picked file awaiting cropping, the cropped blob
  // ready to save, or an explicit removal of the current photo.
  const [cropFile, setCropFile] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  // Preview: the freshly picked file wins; otherwise the stored photo. The
  // object URL is derived (not effect-set state) and revoked when replaced.
  const pickedUrl = useMemo(
    () => (avatarFile ? URL.createObjectURL(avatarFile) : null),
    [avatarFile],
  )
  useEffect(() => {
    if (!pickedUrl) return undefined
    return () => URL.revokeObjectURL(pickedUrl)
  }, [pickedUrl])
  const storedUrl = useFileUrl(!removeAvatar && !avatarFile ? child?.avatarFileId || null : null)
  const previewUrl = pickedUrl || storedUrl

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        dob,
        colorId,
        avatar: { file: avatarFile, remove: removeAvatar },
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title={child ? `Edit ${child.name}` : 'Add a family member'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-field">
          <span className="form-label">Photo</span>
          <div className="avatar-picker">
            {previewUrl ? (
              <img
                className="avatar avatar-photo"
                src={previewUrl}
                alt=""
                width={56}
                height={56}
                style={{ width: 56, height: 56, borderColor: childColor({ colorId }) }}
              />
            ) : (
              <span
                className="avatar"
                style={{ width: 56, height: 56, fontSize: 24, background: childColor({ colorId }) }}
                aria-hidden="true"
              >
                {(name || '?').trim().charAt(0).toUpperCase()}
              </span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0] || null
                if (file) setCropFile(file)
              }}
            />
            <button type="button" className="link-button" onClick={() => fileRef.current?.click()}>
              {previewUrl ? 'Change photo' : 'Choose photo'}
            </button>
            {previewUrl && (
              <button
                type="button"
                className="link-button danger-link"
                onClick={() => {
                  setAvatarFile(null)
                  setRemoveAvatar(true)
                  if (fileRef.current) fileRef.current.value = ''
                }}
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </label>
        <label>
          Date of birth
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
            <button type="button" className="danger-button" onClick={onDelete}>
              Remove
            </button>
          )}
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
      {cropFile && (
        <ImageCropper
          file={cropFile}
          onUse={(blob) => {
            setAvatarFile(blob)
            setRemoveAvatar(false)
            setCropFile(null)
            if (fileRef.current) fileRef.current.value = ''
          }}
          onCancel={() => {
            setCropFile(null)
            if (fileRef.current) fileRef.current.value = ''
          }}
        />
      )}
    </Sheet>
  )
}
