import CalendarScreen from './CalendarScreen.jsx'
import TodosScreen from './TodosScreen.jsx'
import WeekScreen from './WeekScreen.jsx'

const MODES = [
  { id: 'week', label: 'Week' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'todos', label: 'To-dos' },
]

// One bottom-bar destination, three views: Week, Calendar and To-dos share
// the "Planner" slot with Bistro-style pill tabs at the top. The active view
// is owned by App (persisted per device) so Home's shortcut links can
// deep-link and the Planner reopens where you left it.
export default function PlannerScreen({
  mode,
  onModeChange,
  store,
  externalOccurrences,
  focus,
  onFocusHandled,
}) {
  const activeTodoCount = store.data.todos.filter((todo) => !todo.done).length

  const tabs = (
    <div className="mode-tabs" role="tablist" aria-label="Planner views">
      {MODES.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={mode === item.id}
          className={`mode-tab${mode === item.id ? ' active' : ''}`}
          onClick={() => onModeChange(item.id)}
        >
          {item.label}
          {item.id === 'todos' && activeTodoCount > 0 && (
            <span className="mode-tab-count">{activeTodoCount}</span>
          )}
        </button>
      ))}
    </div>
  )

  if (mode === 'todos') {
    return (
      <TodosScreen
        tabs={tabs}
        data={store.data}
        addTodo={store.addTodo}
        updateTodo={store.updateTodo}
        toggleTodo={store.toggleTodo}
        moveTodoToIndex={store.moveTodoToIndex}
        removeTodo={store.removeTodo}
        clearDoneTodos={store.clearDoneTodos}
        focus={focus?.kind === 'todo' ? focus : null}
        onFocusHandled={onFocusHandled}
      />
    )
  }

  if (mode === 'calendar') {
    return (
      <CalendarScreen
        tabs={tabs}
        data={store.data}
        addEvent={store.addEvent}
        updateEvent={store.updateEvent}
        removeEvent={store.removeEvent}
        skipEventOccurrence={store.skipEventOccurrence}
        externalOccurrences={externalOccurrences}
        focus={focus?.kind === 'event' || focus?.kind === 'date' ? focus : null}
        onFocusHandled={onFocusHandled}
      />
    )
  }

  return (
    <WeekScreen
      tabs={tabs}
      data={store.data}
      addEvent={store.addEvent}
      updateEvent={store.updateEvent}
      removeEvent={store.removeEvent}
      skipEventOccurrence={store.skipEventOccurrence}
      toggleTodo={store.toggleTodo}
      externalOccurrences={externalOccurrences}
    />
  )
}
