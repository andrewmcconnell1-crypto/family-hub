import Wordmark from './Wordmark.jsx'

// Shown when cloud sync is configured but nobody is signed in. Google is the
// only provider for now (it's a two-parent app); "use on this device only"
// keeps the local-only mode reachable.
export default function SignInScreen({ onGoogle, onSkip }) {
  return (
    <div className="signin">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="76" height="76" />
      <Wordmark className="signin-wordmark" />
      <p className="muted">
        Your whole family's calendar, to-dos, documents and photos — private, on all your devices.
      </p>
      <button type="button" className="primary-button signin-google" onClick={onGoogle}>
        Continue with Google
      </button>
      <button type="button" className="link-button" onClick={onSkip}>
        Use on this device only
      </button>
    </div>
  )
}
