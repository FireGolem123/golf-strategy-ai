import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Home from './pages/Home'
import Profile from './pages/Profile'
import CourseSetup from './pages/CourseSetup'
import History from './pages/History'
import Scorecard from './pages/Scorecard'
import Auth from './pages/Auth'
import './styles/App.css'

// ── Nav icons ──────────────────────────────────────────────────────
// Feather-icon style: 24×24 viewBox, 2px stroke, rounded joins/caps

function IconCaddie({ active }) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="21" x2="12" y2="6" stroke="currentColor" strokeWidth="2"/>
        <polygon points="12,6 19,9.5 12,13" fill="currentColor"/>
        <ellipse cx="12" cy="21.5" rx="5" ry="1.6" stroke="currentColor" strokeWidth="1.4" fill="none" opacity="0.5"/>
        <circle cx="12" cy="21.5" r="1.8" fill="currentColor"/>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="21" x2="12" y2="6" />
      <polyline points="12,6 19,9.5 12,13" />
      <ellipse cx="12" cy="21.5" rx="5" ry="1.6" opacity="0.5"/>
    </svg>
  )
}

function IconProfile() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  )
}

function IconCourse() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3,6 9,3 15,6 21,3 21,18 15,21 9,18 3,21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  )
}

function IconScore() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  )
}

function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12,7 12,12 15,15" />
    </svg>
  )
}

function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        {({ isActive }) => (
          <>
            <span className="nav-icon"><IconCaddie active={isActive} /></span>
            <span className="nav-label">Caddie</span>
          </>
        )}
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon"><IconProfile /></span>
        <span className="nav-label">Profile</span>
      </NavLink>
      <NavLink to="/course-setup" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon"><IconCourse /></span>
        <span className="nav-label">Course</span>
      </NavLink>
      <NavLink to="/scorecard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon"><IconScore /></span>
        <span className="nav-label">Score</span>
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon"><IconHistory /></span>
        <span className="nav-label">History</span>
      </NavLink>
    </nav>
  )
}

// ── Data migration ──────────────────────────────────────────────────
// Called after signing in to a real account when anonymous data exists in this browser.
// Requires the migrate_anonymous_data RPC to be created in Supabase (see PROJECT_NOTES).

async function migrateAnonData(anonUserId) {
  try {
    const { error } = await supabase.rpc('migrate_anonymous_data', { anon_user_id: anonUserId })
    if (error) {
      console.error('Anonymous data migration failed:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('Anonymous data migration error:', err)
    return false
  }
}

// ── App ─────────────────────────────────────────────────────────────

export default function App() {
  // undefined = still loading, null = no session, object = active session
  const [session, setSession] = useState(undefined)
  const [migrationNotice, setMigrationNotice] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Store anonymous user_id so we can migrate data after real sign-in
      if (session?.user?.is_anonymous) {
        localStorage.setItem('golf_anon_uid', session.user.id)
      }
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)

      if (event === 'SIGNED_IN' && session && !session.user.is_anonymous) {
        const anonUserId = localStorage.getItem('golf_anon_uid')
        if (anonUserId && anonUserId !== session.user.id) {
          const ok = await migrateAnonData(anonUserId)
          if (!ok) {
            setMigrationNotice('Some data from your previous session may not have transferred.')
          }
        }
        localStorage.removeItem('golf_anon_uid')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null

  const isAuthenticated = session != null && !session.user.is_anonymous

  return (
    <BrowserRouter>
      <div className="app-layout">
        {migrationNotice && (
          <div className="migration-notice">
            {migrationNotice}
            <button
              type="button"
              className="migration-notice-dismiss"
              onClick={() => setMigrationNotice(null)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
        <main className="app-main">
          <Routes>
            <Route
              path="/auth"
              element={isAuthenticated ? <Navigate to="/" replace /> : <Auth />}
            />
            {isAuthenticated ? (
              <>
                <Route path="/" element={<Home />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/course-setup" element={<CourseSetup />} />
                <Route path="/scorecard" element={<Scorecard />} />
                <Route path="/history" element={<History />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            ) : (
              <Route path="*" element={<Navigate to="/auth" replace />} />
            )}
          </Routes>
        </main>
        {isAuthenticated && <BottomNav />}
      </div>
    </BrowserRouter>
  )
}
