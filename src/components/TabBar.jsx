import { CalendarDays, FolderOpen, Home, Image, ListTodo, Users } from 'lucide-react'

const TABS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'todos', label: 'To-dos', icon: ListTodo },
  { id: 'documents', label: 'Docs', icon: FolderOpen },
  { id: 'photos', label: 'Photos', icon: Image },
  { id: 'family', label: 'Family', icon: Users },
]

export default function TabBar({ tab, onChange }) {
  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`tab-button${tab === id ? ' tab-active' : ''}`}
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => onChange(id)}
        >
          <Icon size={22} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
