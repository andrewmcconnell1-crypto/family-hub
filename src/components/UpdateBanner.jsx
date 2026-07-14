import { RefreshCw } from 'lucide-react'

// Shown when a newer build has been deployed while the app is open.
export default function UpdateBanner({ onReload }) {
  return (
    <div className="update-banner" role="status">
      <span className="update-banner-text">
        <RefreshCw size={16} aria-hidden="true" />
        A new version is available.
      </span>
      <button type="button" className="primary-button" onClick={onReload}>
        Refresh
      </button>
    </div>
  )
}
