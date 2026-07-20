import { useMemo, useRef, useState } from 'react'
import TabBar from './components/TabBar.jsx'
import HomeScreen from './components/HomeScreen.jsx'
import PlannerScreen from './components/PlannerScreen.jsx'
import DocumentsScreen from './components/DocumentsScreen.jsx'
import PhotosScreen from './components/PhotosScreen.jsx'
import FamilyScreen from './components/FamilyScreen.jsx'
import SignInScreen from './components/SignInScreen.jsx'
import InviteBanner from './components/InviteBanner.jsx'
import UpdateBanner from './components/UpdateBanner.jsx'
import Wallpaper from './components/Wallpaper.jsx'
import { useAuth } from './hooks/useAuth.js'
import { useUpdatePrompt } from './hooks/useUpdatePrompt.js'
import { useFamilyStore } from './hooks/useFamilyStore.js'
import { useExternalCalendars } from './hooks/useExternalCalendars.js'
import { useHousehold } from './hooks/useHousehold.js'
import { useTheme } from './hooks/useTheme.js'
import { captureJoinCodeFromUrl, clearPendingJoinCode } from './lib/household.js'
import { isSupabaseConfigured } from './lib/supabase.js'

const LOCAL_ONLY_KEY = 'treehouse:localOnly'
const PLANNER_MODE_KEY = 'treehouse:plannerMode'
const WALLPAPER_KEY = 'treehouse:wallpaper'

export default function App() {
  const [tab, setTab] = useState('home')
  // Which of the Planner's top tabs (week | calendar | todos) is active.
  // Lives here so Home's shortcut links can deep-link straight to a view,
  // and is remembered per device so the Planner reopens where you left it.
  const [plannerMode, setPlannerModeState] = useState(() => {
    const saved = localStorage.getItem(PLANNER_MODE_KEY)
    return saved === 'calendar' || saved === 'todos' ? saved : 'week'
  })
  const setPlannerMode = (mode) => {
    localStorage.setItem(PLANNER_MODE_KEY, mode)
    setPlannerModeState(mode)
  }

  // A specific Planner item to open when we land there, set by Home's
  // deep-links: { kind: 'event' | 'todo' | 'date', id?, date? }. Cleared once
  // the target screen has opened it.
  const [plannerFocus, setPlannerFocus] = useState(null)

  // Navigation targets are bottom-bar tabs, plus the virtual 'week' /
  // 'calendar' / 'todos' ids used by Home's shortcuts, which land on the
  // Planner tab.
  const navigate = (target) => {
    setPlannerFocus(null)
    if (target === 'week' || target === 'calendar' || target === 'todos') {
      setPlannerMode(target)
      setTab('planner')
      return
    }
    setTab(target)
  }

  // Open a specific event or to-do (or just a calendar date) in the Planner —
  // used by the clickable items on Home.
  const openItem = (target) => {
    if (target.type === 'todo') {
      setPlannerMode('todos')
      setPlannerFocus({ kind: 'todo', id: target.id })
    } else if (target.type === 'event') {
      setPlannerMode('calendar')
      setPlannerFocus({ kind: 'event', id: target.id, date: target.date })
    } else {
      setPlannerMode('calendar')
      setPlannerFocus({ kind: 'date', date: target.date })
    }
    setTab('planner')
  }
  const auth = useAuth()
  const household = useHousehold(auth.user)
  // Cloud data owner: resolved household owner. Null until resolution
  // finishes, which pauses cloud sync rather than loading the wrong row.
  const ownerId = household.loading ? null : household.ownerId
  const store = useFamilyStore(auth.user, ownerId)
  const externalCalendars = useExternalCalendars(store.data.externalCalendars)
  // Invite code captured from a ?join=CODE link (survives the sign-in
  // redirect in sessionStorage).
  const [pendingJoinCode, setPendingJoinCode] = useState(() => captureJoinCodeFromUrl())
  // "Use on this device only": remembered so the sign-in screen doesn't come
  // back on every load. Signing in later clears it (Family tab).
  const [localOnly, setLocalOnly] = useState(
    () => localStorage.getItem(LOCAL_ONLY_KEY) === '1',
  )
  const updateReady = useUpdatePrompt()
  const { theme, setTheme } = useTheme()
  const [wallpaper, setWallpaperState] = useState(
    () => localStorage.getItem(WALLPAPER_KEY) !== '0',
  )
  const setWallpaper = (on) => {
    localStorage.setItem(WALLPAPER_KEY, on ? '1' : '0')
    setWallpaperState(on)
  }

  // Undo for deletes: mutate immediately, keep a snapshot for a few seconds.
  // File blobs are only purged when the undo window closes, so undo restores
  // documents/photos completely.
  const [undoMessage, setUndoMessage] = useState(null)
  const undoRef = useRef(null) // { snapshot, fileIds } for the pending delete
  const undoTimerRef = useRef(null)

  const finalizeUndo = () => {
    clearTimeout(undoTimerRef.current)
    const pending = undoRef.current
    if (pending?.fileIds.length) store.purgeFiles(pending.fileIds)
    undoRef.current = null
    setUndoMessage(null)
  }

  const deleteWithUndo = (message, mutate, fileIds = []) => {
    // A new delete finalizes any previous pending one first.
    finalizeUndo()
    undoRef.current = { snapshot: store.data, fileIds }
    mutate()
    setUndoMessage(message)
    undoTimerRef.current = setTimeout(finalizeUndo, 6000)
  }

  const undo = () => {
    clearTimeout(undoTimerRef.current)
    if (undoRef.current) store.restore(undoRef.current.snapshot)
    undoRef.current = null
    setUndoMessage(null)
  }

  // The store, with destructive actions routed through the undo machinery.
  const actions = useMemo(
    () => ({
      ...store,
      removeEvent: (id) => {
        const event = store.data.events.find((e) => e.id === id)
        deleteWithUndo(
          event?.repeat !== 'none' ? 'Series deleted' : 'Event deleted',
          () => store.removeEvent(id),
        )
      },
      skipEventOccurrence: (id, dateKey) =>
        deleteWithUndo('Day removed from series', () => store.skipEventOccurrence(id, dateKey)),
      removeTodo: (id) => deleteWithUndo('To-do deleted', () => store.removeTodo(id)),
      clearDoneTodos: () =>
        deleteWithUndo('Completed to-dos cleared', () => store.clearDoneTodos()),
      removeDocument: (id) => {
        const doc = store.data.documents.find((x) => x.id === id)
        deleteWithUndo('Document deleted', () => store.removeDocument(id), doc ? [doc.fileId] : [])
      },
      removePhoto: (id) => {
        const photo = store.data.photos.find((x) => x.id === id)
        deleteWithUndo('Photo deleted', () => store.removePhoto(id), photo ? [photo.fileId] : [])
      },
      removeChild: (id) => {
        const member = store.data.children.find((c) => c.id === id)
        deleteWithUndo(
          member ? `${member.name} removed` : 'Member removed',
          () => store.removeChild(id),
          member?.avatarFileId ? [member.avatarFileId] : [],
        )
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.data],
  )

  const dismissInvite = () => {
    clearPendingJoinCode()
    setPendingJoinCode(null)
  }

  if (auth.loading) {
    return <div className="app-loading" aria-label="Loading" />
  }

  if (isSupabaseConfigured && !auth.user && !localOnly) {
    return (
      <SignInScreen
        onGoogle={auth.signInWithGoogle}
        onSkip={() => {
          localStorage.setItem(LOCAL_ONLY_KEY, '1')
          setLocalOnly(true)
        }}
      />
    )
  }

  return (
    <div className="app">
      <Wallpaper photos={store.data.photos} enabled={wallpaper} />
      <main className="app-main">
        {pendingJoinCode && auth.user && (
          <InviteBanner
            code={pendingJoinCode}
            onJoined={() => {
              dismissInvite()
              household.refresh()
              setTab('family')
            }}
            onDismiss={dismissInvite}
          />
        )}
        {tab === 'home' && (
          <HomeScreen
            data={store.data}
            onNavigate={navigate}
            onOpen={openItem}
            externalOccurrences={externalCalendars.occurrencesInRange}
          />
        )}
        {tab === 'planner' && (
          <PlannerScreen
            mode={plannerMode}
            onModeChange={(mode) => {
              // Switching pills is a fresh navigation — drop any deep-link
              // focus so it doesn't re-open when the view remounts.
              setPlannerFocus(null)
              setPlannerMode(mode)
            }}
            store={actions}
            externalOccurrences={externalCalendars.occurrencesInRange}
            focus={plannerFocus}
          />
        )}
        {tab === 'documents' && (
          <DocumentsScreen
            data={store.data}
            addDocument={store.addDocument}
            updateDocument={store.updateDocument}
            removeDocument={actions.removeDocument}
          />
        )}
        {tab === 'photos' && (
          <PhotosScreen
            data={store.data}
            addPhotos={store.addPhotos}
            updatePhoto={store.updatePhoto}
            removePhoto={actions.removePhoto}
          />
        )}
        {tab === 'family' && (
          <FamilyScreen
            data={store.data}
            addChild={store.addChild}
            updateChild={store.updateChild}
            removeChild={actions.removeChild}
            addExternalCalendar={store.addExternalCalendar}
            updateExternalCalendar={store.updateExternalCalendar}
            removeExternalCalendar={store.removeExternalCalendar}
            externalCalendars={externalCalendars}
            syncState={store.syncState}
            user={auth.user}
            household={household}
            theme={theme}
            onThemeChange={setTheme}
            wallpaper={wallpaper}
            onWallpaperChange={setWallpaper}
            onSignIn={() => {
              localStorage.removeItem(LOCAL_ONLY_KEY)
              if (auth.user) return
              if (isSupabaseConfigured) auth.signInWithGoogle()
              else setLocalOnly(false)
            }}
            onSignOut={auth.signOut}
          />
        )}
      </main>
      <TabBar tab={tab} onChange={navigate} />
      {undoMessage && (
        <div className="undo-snackbar" role="status">
          <span>{undoMessage}</span>
          <button type="button" className="undo-button" onClick={undo}>
            Undo
          </button>
        </div>
      )}
      {updateReady && <UpdateBanner onReload={() => window.location.reload()} />}
    </div>
  )
}
