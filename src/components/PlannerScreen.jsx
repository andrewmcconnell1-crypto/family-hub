import CalendarScreen from './CalendarScreen.jsx'
import TodosScreen from './TodosScreen.jsx'

// One bottom-bar destination, two views: Calendar and To-dos share the
// "Planner" slot with Bistro-style pill tabs at the top. The active view is
// owned by App so Home's shortcut links can deep-link to either tab.
export default function PlannerScreen({ mode, onModeChange, store }) {
  const activeTodoCount = store.data.todos.filter((todo) => !todo.done).length

  const tabs = (
    <div className="mode-tabs" role="tablist" aria-label="Planner views">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'calendar'}
        className={`mode-tab${mode === 'calendar' ? ' active' : ''}`}
        onClick={() => onModeChange('calendar')}
      >
        Calendar
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'todos'}
        className={`mode-tab${mode === 'todos' ? ' active' : ''}`}
        onClick={() => onModeChange('todos')}
      >
        To-dos
        {activeTodoCount > 0 && <span className="mode-tab-count">{activeTodoCount}</span>}
      </button>
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
        moveTodo={store.moveTodo}
        removeTodo={store.removeTodo}
        clearDoneTodos={store.clearDoneTodos}
      />
    )
  }

  return (
    <CalendarScreen
      tabs={tabs}
      data={store.data}
      addEvent={store.addEvent}
      updateEvent={store.updateEvent}
      removeEvent={store.removeEvent}
      skipEventOccurrence={store.skipEventOccurrence}
    />
  )
}
