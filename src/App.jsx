import { useState } from 'react'
import TabBar from './components/TabBar.jsx'
import HomeScreen from './components/HomeScreen.jsx'
import CalendarScreen from './components/CalendarScreen.jsx'
import DocumentsScreen from './components/DocumentsScreen.jsx'
import PhotosScreen from './components/PhotosScreen.jsx'
import FamilyScreen from './components/FamilyScreen.jsx'
import SignInScreen from './components/SignInScreen.jsx'
import { useAuth } from './hooks/useAuth.js'
import { useFamilyStore } from './hooks/useFamilyStore.js'
import { isSupabaseConfigured } from './lib/supabase.js'

const LOCAL_ONLY_KEY = 'treehouse:localOnly'

export default function App() {
  const [tab, setTab] = useState('home')
  const auth = useAuth()
  const store = useFamilyStore(auth.user)
  // "Use on this device only": remembered so the sign-in screen doesn't come
  // back on every load. Signing in later clears it (Family tab).
  const [localOnly, setLocalOnly] = useState(
    () => localStorage.getItem(LOCAL_ONLY_KEY) === '1',
  )

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
        {tab === 'home' && <HomeScreen data={store.data} onNavigate={setTab} />}
        {tab === 'calendar' && (
          <CalendarScreen
            data={store.data}
            addEvent={store.addEvent}
            updateEvent={store.updateEvent}
            removeEvent={store.removeEvent}
          />
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
      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}
