import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Home from './pages/Home'
import Profile from './pages/Profile'
import CourseSetup from './pages/CourseSetup'
import History from './pages/History'
import Scorecard from './pages/Scorecard'
import './styles/App.css'

function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon">⛳</span>
        <span className="nav-label">Caddie</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon">👤</span>
        <span className="nav-label">Profile</span>
      </NavLink>
      <NavLink to="/course-setup" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon">🗺️</span>
        <span className="nav-label">Course</span>
      </NavLink>
      <NavLink to="/scorecard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon">📝</span>
        <span className="nav-label">Score</span>
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon">📋</span>
        <span className="nav-label">History</span>
      </NavLink>
    </nav>
  )
}

export default function App() {
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthReady(true)
      } else {
        supabase.auth.signInAnonymously().then(() => setAuthReady(true))
      }
    })
  }, [])

  if (!authReady) return null

  return (
    <BrowserRouter>
      <div className="app-layout">
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/course-setup" element={<CourseSetup />} />
            <Route path="/scorecard" element={<Scorecard />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
