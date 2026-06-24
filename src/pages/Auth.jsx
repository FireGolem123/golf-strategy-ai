import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { LogoMark } from '../components/Logo'
import '../styles/Auth.css'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function translateError(msg) {
  if (!msg) return 'Something went wrong. Please try again.'
  if (msg.includes('Invalid login credentials')) return 'Incorrect email or password.'
  if (msg.includes('Email not confirmed')) return 'Please confirm your email before signing in. Check your inbox.'
  if (msg.includes('User already registered')) return 'An account with this email already exists — sign in instead.'
  if (msg.includes('Password should be at least')) return 'Password must be at least 8 characters.'
  if (msg.includes('Unable to validate email')) return 'Enter a valid email address.'
  if (msg.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.'
  return msg
}

export default function Auth() {
  const [tab, setTab] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [anonSession, setAnonSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.is_anonymous) setAnonSession(session)
    })
  }, [])

  function validate() {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.')
      return false
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return false
    }
    return true
  }

  async function handleEmailAuth(e) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!validate()) return

    setLoading(true)

    if (tab === 'signup') {
      let err
      if (anonSession) {
        // Promote the anonymous account to a real email account — user_id stays the same
        ;({ error: err } = await supabase.auth.updateUser({ email, password }))
      } else {
        ;({ error: err } = await supabase.auth.signUp({ email, password }))
      }
      if (err) { setError(translateError(err.message)); setLoading(false); return }
      setConfirmationSent(true)
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setError(translateError(err.message)); setLoading(false); return }
      // Migration handled in App.jsx onAuthStateChange
    }

    setLoading(false)
  }

  async function handleGoogle() {
    setError(null)
    setNotice(null)
    setLoading(true)

    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })

    if (err) { setError(translateError(err.message)); setLoading(false) }
    // On success the browser navigates to Google, then back — onAuthStateChange handles the rest
  }

  async function handleForgotPassword() {
    setError(null)
    setNotice(null)
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter your email address above, then click Forgot password.')
      return
    }
    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    })
    setLoading(false)
    if (err) { setError(translateError(err.message)); return }
    setNotice('Password reset email sent — check your inbox.')
  }

  if (confirmationSent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-confirm-state">
            <div className="auth-confirm-icon">✉️</div>
            <h2 className="auth-confirm-title">Check your email</h2>
            <p className="auth-confirm-text">
              We sent a confirmation link to <strong>{email}</strong>.<br />
              Click it to activate your account and you'll be signed in automatically.
            </p>
          </div>
          <button
            className="auth-tab-link"
            onClick={() => { setConfirmationSent(false); setError(null); setNotice(null) }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <LogoMark size={72} />
        <h1 className="auth-title">Caddie AI</h1>
        <p className="auth-subtitle">Your smart golf companion</p>
      </div>

      <div className="auth-card">
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${tab === 'signin' ? 'active' : ''}`}
            onClick={() => { setTab('signin'); setError(null); setNotice(null) }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => { setTab('signup'); setError(null); setNotice(null) }}
          >
            Sign Up
          </button>
        </div>

        <button
          type="button"
          className="auth-google-btn"
          onClick={handleGoogle}
          disabled={loading}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="auth-divider">or</div>

        {error && <div className="auth-error">{error}</div>}
        {notice && <div className="auth-success">{notice}</div>}

        <form onSubmit={handleEmailAuth}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              placeholder={tab === 'signup' ? 'Min 8 characters' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading
              ? (tab === 'signup' ? 'Creating account…' : 'Signing in…')
              : (tab === 'signup' ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        {tab === 'signin' && (
          <button
            type="button"
            className="auth-forgot"
            onClick={handleForgotPassword}
            disabled={loading}
          >
            Forgot password?
          </button>
        )}
      </div>
    </div>
  )
}
