import { useState } from 'react'
import TabBar from './components/TabBar.jsx'
import HomeScreen from './components/HomeScreen.jsx'
import PlannerScreen from './components/PlannerScreen.jsx'
import DocumentsScreen from './components/DocumentsScreen.jsx'
import PhotosScreen from './components/PhotosScreen.jsx'
import FamilyScreen from './components/FamilyScreen.jsx'
import SignInScreen from './components/SignInScreen.jsx'
import InviteBanner from './components/InviteBanner.jsx'
import { useAuth } from './hooks/useAuth.js'
import { useFamilyStore } from './hooks/useFamilyStore.js'
import { useHousehold } from './hooks/useHousehold.js'
import { captureJoinCodeFromUrl, clearPendingJoinCode } from './lib/household.js'
import { isSupabaseConfigured } from './lib/supabase.js'

const LOCAL_ONLY_KEY = 'treehouse:localOnly'

export default function App() {
  const [tab, setTab] = useState('home')
  // Which of the Planner's top tabs (calendar | todos) is active. Lives here
  // so Home's shortcut links can deep-link straight to either view.
  const [plannerMode, setPlannerMode] = useState('calendar')

  // Navigation targets are bottom-bar tabs, plus the virtual 'calendar' /
  // 'todos' ids used by Home's shortcuts, which land on the Planner tab.
  const navigate = (target) => {
    if (target === 'calendar' || target === 'todos') {
      setPlannerMode(target)
      setTab('planner')
      return
    }
    setTab(target)
  }
  const auth = useAuth()
  const household = useHousehold(auth.user)
  // Cloud data owner: resolved household owner. Null until resolution
  // finishes, which pauses cloud sync rather than loading the wrong row.
  const ownerId = household.loading ? null : household.ownerId
  const store = useFamilyStore(auth.user, ownerId)
  // Invite code captured from a ?join=CODE link (survives the sign-in
  // redirect in sessionStorage).
  const [pendingJoinCode, setPendingJoinCode] = useState(() => captureJoinCodeFromUrl())
  // "Use on this device only": remembered so the sign-in screen doesn't come
  // back on every load. Signing in later clears it (Family tab).
  const [localOnly, setLocalOnly] = useState(
    () => localStorage.getItem(LOCAL_ONLY_KEY) === '1',
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
        {tab === 'home' && <HomeScreen data={store.data} onNavigate={navigate} />}
        {tab === 'planner' && (
          <PlannerScreen mode={plannerMode} onModeChange={setPlannerMode} store={store} />
        )}
        {tab === 'documents' && (
          <DocumentsScreen
            data={store.data}
            addDocument={store.addDocument}
            removeDocument={store.removeDocument}
          />
        )}
        {tab === 'photos' && (
          <PhotosScreen data={store.data} addPhotos={store.addPhotos} removePhoto={store.removePhoto} />
        )}
        {tab === 'family' && (
          <FamilyScreen
            data={store.data}
            addChild={store.addChild}
            updateChild={store.updateChild}
            removeChild={store.removeChild}
            syncState={store.syncState}
            user={auth.user}
            household={household}
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
    </div>
  )
}
