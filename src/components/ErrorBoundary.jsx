import { Component } from 'react'

// Last line of defence: a render crash anywhere shows a friendly recovery
// card instead of a white screen. Data is safe — it's persisted on every
// change — so a reload almost always recovers.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Treehouse crashed', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="error-screen">
        <div className="card error-card">
          <h1>Something went wrong</h1>
          <p className="muted">
            Sorry — the app hit an unexpected error. Your data is safe; reloading almost always
            fixes it.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => window.location.reload()}
          >
            Reload Treehouse
          </button>
        </div>
      </div>
    )
  }
}
