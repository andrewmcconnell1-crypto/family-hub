import { useState } from 'react'
import TabBar from './components/TabBar.jsx'
import HomeScreen from './components/HomeScreen.jsx'
import CalendarScreen from './components/CalendarScreen.jsx'
import DocumentsScreen from './components/DocumentsScreen.jsx'
import PhotosScreen from './components/PhotosScreen.jsx'
import FamilyScreen from './components/FamilyScreen.jsx'
import { useFamilyStore } from './hooks/useFamilyStore.js'

export default function App() {
  const [tab, setTab] = useState('home')
  const store = useFamilyStore()

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
          />
        )}
      </main>
      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}
