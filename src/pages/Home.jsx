import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getClubRecommendation, getRoundStrategy } from '../lib/claude'
import { getCurrentWeather, windDir } from '../lib/weather'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { useCourseData } from '../hooks/useCourseData'
import { LogoHorizontal } from '../components/Logo'
import '../styles/Home.css'

const HOLES = Array.from({ length: 18 }, (_, i) => i + 1)

function StarRating({ value, onChange }) {
  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star ${star <= value ? 'filled' : ''}`}
          onClick={() => onChange(star)}
          aria-label={`${star} stars`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

const SECTION_PILLS = {
  '🏌️': { label: 'SITUATION', color: 'pill-situation' },
  '✅': { label: 'PLAY', color: 'pill-play' },
  '⚠️': { label: 'RISK / REWARD', color: 'pill-risk' },
  '🌦️': { label: 'CONDITIONS', color: 'pill-conditions' },
  '🗺️': { label: 'ROUND PLAN', color: 'pill-play' },
  '📊': { label: 'THEMES', color: 'pill-situation' },
  '⛳': { label: 'HOLES', color: 'pill-conditions' },
  '🎯': { label: 'FOCUS', color: 'pill-risk' },
}

function RecommendationDisplay({ text }) {
  const lines = text.split('\n')
  return (
    <div className="recommendation">
      {lines.map((line, i) => {
        const pill = Object.entries(SECTION_PILLS).find(([emoji]) => line.startsWith(emoji))
        if (pill) {
          const [emoji, { label, color }] = pill
          const rest = line.replace(emoji, '').trim()
          return (
            <div key={i} className="rec-section-header">
              <span className={`rec-pill ${color}`}>{label}</span>
              {rest && <span className="rec-pill-text">{rest}</span>}
            </div>
          )
        }
        if (line.startsWith('Club:')) {
          return <p key={i} className="rec-club-line">{line}</p>
        }
        if (line.trim() === '') {
          return <div key={i} className="rec-spacer" />
        }
        return <p key={i} className="rec-line">{line}</p>
      })}
    </div>
  )
}

export default function Home() {
  const [courseNames, setCourseNames] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedHole, setSelectedHole] = useState('')
  const [playerProfile, setPlayerProfile] = useState(null)
  const [clubProfiles, setClubProfiles] = useState([])
  const [shotHistory, setShotHistory] = useState([])
  const [recommendation, setRecommendation] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [activeRoundId, setActiveRoundId] = useState(null)

  // Caddie mode
  const [caddieMode, setCaddieMode] = useState('hole') // 'hole' | 'round'
  const [allCourseHoles, setAllCourseHoles] = useState([])
  const [roundStrategy, setRoundStrategy] = useState('')
  const [roundStrategyLoading, setRoundStrategyLoading] = useState(false)

  // Mid-round notes
  const [roundNotes, setRoundNotes] = useState('')
  const [showRoundNotes, setShowRoundNotes] = useState(false)
  const roundNotesTimerRef = useRef(null)

  const [weather, setWeather] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState(null)

  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false)
  const [rating, setRating] = useState(0)
  const [clubUsed, setClubUsed] = useState('')
  const [outcome, setOutcome] = useState('')
  const [feedbackSaved, setFeedbackSaved] = useState(false)

  const { transcript, setTranscript, isListening, startListening, stopListening, error: voiceError, isSupported } = useVoiceInput()
  const { courseHole } = useCourseData(selectedCourse, selectedHole ? parseInt(selectedHole) : null)

  useEffect(() => {
    loadInitialData()
    fetchWeather()
  }, [])

  // Load all holes for selected course (used in round mode)
  useEffect(() => {
    if (!selectedCourse) { setAllCourseHoles([]); return }
    supabase.from('course_holes').select('*').eq('course_name', selectedCourse)
      .order('hole_number').then(({ data }) => setAllCourseHoles(data || []))
  }, [selectedCourse])

  // Debounce-save round notes to Supabase rounds.notes
  useEffect(() => {
    if (!activeRoundId) return
    if (roundNotesTimerRef.current) clearTimeout(roundNotesTimerRef.current)
    roundNotesTimerRef.current = setTimeout(async () => {
      await supabase.from('rounds').update({ notes: roundNotes || null }).eq('id', activeRoundId)
    }, 1500)
    return () => { if (roundNotesTimerRef.current) clearTimeout(roundNotesTimerRef.current) }
  }, [roundNotes, activeRoundId])

  async function loadInitialData() {
    const { data: { user } } = await supabase.auth.getUser()

    const { data: holes } = await supabase.from('course_holes').select('course_name')
    if (holes) setCourseNames([...new Set(holes.map(h => h.course_name))])

    if (!user) return

    const { data: profile } = await supabase
      .from('player_profile').select('*').eq('user_id', user.id).maybeSingle()
    setPlayerProfile(profile)

    const { data: clubs } = await supabase
      .from('club_profiles').select('*').eq('user_id', user.id)
      .order('carry_distance', { ascending: false })
    setClubProfiles(clubs || [])

    const { data: shots } = await supabase
      .from('shot_history')
      .select('club_suggested, club_used, suggestion_rating, outcome')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setShotHistory(shots || [])

    const today = new Date().toISOString().split('T')[0]
    const { data: existingRound } = await supabase
      .from('rounds').select('id, notes').eq('user_id', user.id).eq('date', today).maybeSingle()
    if (existingRound) {
      setActiveRoundId(existingRound.id)
      if (existingRound.notes) setRoundNotes(existingRound.notes)
    }
  }

  async function fetchWeather() {
    setWeatherLoading(true)
    setWeatherError(null)
    try {
      const w = await getCurrentWeather()
      setWeather(w)
    } catch (err) {
      setWeatherError(err.message)
    } finally {
      setWeatherLoading(false)
    }
  }

  async function handleSubmit() {
    if (!transcript.trim()) return
    setLoading(true)
    setApiError(null)
    setRecommendation('')
    setShowFeedback(false)
    setFeedbackSaved(false)
    try {
      const result = await getClubRecommendation(transcript, playerProfile, clubProfiles, courseHole, shotHistory, weather, roundNotes)
      setRecommendation(result)
      setShowFeedback(true)
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRoundStrategy() {
    if (!selectedCourse) return
    setRoundStrategyLoading(true)
    setApiError(null)
    setRoundStrategy('')
    try {
      const result = await getRoundStrategy(selectedCourse, allCourseHoles, playerProfile, clubProfiles, shotHistory, weather, roundNotes)
      setRoundStrategy(result)
    } catch (err) {
      setApiError(err.message)
    } finally {
      setRoundStrategyLoading(false)
    }
  }

  async function handleFeedbackSave() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let roundId = activeRoundId
    if (!roundId) {
      const today = new Date().toISOString().split('T')[0]
      const { data: round } = await supabase
        .from('rounds')
        .insert({ user_id: user.id, course_name: selectedCourse || null, date: today })
        .select('id').single()
      if (round) { roundId = round.id; setActiveRoundId(round.id) }
    }

    const clubMatch = recommendation.match(/Club:\s*([^\n]+)/)
    const suggestedClub = clubMatch ? clubMatch[1].trim() : null

    const newShot = {
      user_id: user.id,
      round_id: roundId,
      hole_number: selectedHole ? parseInt(selectedHole) : null,
      distance_to_pin: null,
      club_suggested: suggestedClub,
      club_used: clubUsed || null,
      suggestion_rating: rating || null,
      outcome: outcome || null,
      conditions_noted: transcript,
    }
    await supabase.from('shot_history').insert(newShot)

    setShotHistory(prev => [newShot, ...prev].slice(0, 30))
    setFeedbackSaved(true)
  }

  const handleMicToggle = () => {
    if (isListening) stopListening()
    else startListening()
  }

  const handleModeSwitch = (mode) => {
    setCaddieMode(mode)
    setRecommendation('')
    setRoundStrategy('')
    setApiError(null)
  }

  return (
    <div className="page home-page">
      <div className="home-header">
        <LogoHorizontal />
      </div>

      {/* Weather bar */}
      <div className="weather-bar">
        {weatherLoading && <span className="weather-loading">Getting weather…</span>}
        {weather && !weatherLoading && (
          <>
            <span className="weather-temp">{weather.temp}°F</span>
            <span className="weather-divider">·</span>
            <span className="weather-wind">
              {weather.wind_speed} mph {windDir(weather.wind_deg)}
              {weather.wind_gust ? ` (gusts ${weather.wind_gust})` : ''}
            </span>
            <span className="weather-divider">·</span>
            <span className="weather-condition">{weather.condition}</span>
            {weather.location && (
              <span className="weather-location">{weather.location}</span>
            )}
            <button className="weather-refresh" onClick={fetchWeather} title="Refresh weather">
              ↻
            </button>
          </>
        )}
        {weatherError && !weatherLoading && (
          <button className="weather-retry" onClick={fetchWeather}>
            Get weather
          </button>
        )}
      </div>

      {/* Mode toggle */}
      <div className="caddie-mode-toggle">
        <button
          className={`mode-btn ${caddieMode === 'hole' ? 'active' : ''}`}
          onClick={() => handleModeSwitch('hole')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <line x1="7" y1="12" x2="7" y2="4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <polygon points="7,4.5 11.5,6.5 7,8.5" fill="currentColor"/>
            <ellipse cx="7" cy="12.3" rx="3.2" ry="1.1" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.5"/>
          </svg>
          Hole Caddie
        </button>
        <button
          className={`mode-btn ${caddieMode === 'round' ? 'active' : ''}`}
          onClick={() => handleModeSwitch('round')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 3.5l4-1.5 4 1.5 4-1.5v7.5l-4 1.5-4-1.5-4 1.5V3.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            <line x1="5" y1="2" x2="5" y2="11" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
            <line x1="9" y1="3.5" x2="9" y2="12.5" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
          </svg>
          Round Plan
        </button>
      </div>

      {/* Course selector — shared between modes */}
      <div className="selector-row">
        <div className="form-group selector-item">
          <label className="form-label">Course</label>
          <select
            className="form-select"
            value={selectedCourse}
            onChange={e => setSelectedCourse(e.target.value)}
          >
            <option value="">Select course</option>
            {courseNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* Hole selector — hole mode only */}
        {caddieMode === 'hole' && (
          <div className="form-group selector-item">
            <label className="form-label">Hole</label>
            <select
              className="form-select"
              value={selectedHole}
              onChange={e => setSelectedHole(e.target.value)}
            >
              <option value="">—</option>
              {HOLES.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Hole info badge — always rendered to reserve layout space, hidden when not applicable */}
      <div className={`hole-info-badge${(!courseHole || caddieMode !== 'hole') ? ' hole-info-badge--empty' : ''}`}>
        {courseHole && caddieMode === 'hole' && (
          <>
            <span>
              Hole {courseHole.hole_number} · Par {courseHole.par}
              {(() => {
                const yards = [courseHole.yardage_black, courseHole.yardage_blue, courseHole.yardage_white]
                  .filter(Boolean)
                  .filter((v, i, a) => a.indexOf(v) === i)
                return yards.length > 0 ? ` · ${yards.join(' / ')} yds` : ''
              })()}
            </span>
            {courseHole.hazards && <span className="hole-hazard">⚠ {courseHole.hazards}</span>}
          </>
        )}
      </div>

      {/* Mid-round notes — shown when there's an active round */}
      {activeRoundId && (
        <div className="round-notes-section">
          <button
            className="round-notes-toggle"
            onClick={() => setShowRoundNotes(v => !v)}
          >
            <span>🎯 Round Adjustments{roundNotes.trim() ? ' ●' : ''}</span>
            <span className="round-notes-chevron">{showRoundNotes ? '▲' : '▼'}</span>
          </button>
          {showRoundNotes && (
            <div className="round-notes-body">
              <textarea
                className="form-textarea"
                placeholder="Note patterns you're seeing this round — e.g. 'irons going right and short today, driver feeling solid, greens are fast'"
                value={roundNotes}
                onChange={e => setRoundNotes(e.target.value)}
                rows={3}
              />
              <p className="round-notes-hint">These will be factored into every recommendation this round.</p>
            </div>
          )}
        </div>
      )}

      {/* ── HOLE MODE ── */}
      {caddieMode === 'hole' && (
        <>
          {/* Voice input */}
          <div className="voice-section">
            <button
              className={`mic-button ${isListening ? 'listening' : ''}`}
              onClick={handleMicToggle}
              disabled={!isSupported}
              aria-label={isListening ? 'Stop listening' : 'Start listening'}
            >
              <span className="mic-icon">
                {isListening ? (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/>
                  </svg>
                ) : (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="2" width="6" height="11" rx="3"/>
                    <path d="M5 10a7 7 0 0014 0"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                    <line x1="9" y1="21" x2="15" y2="21"/>
                  </svg>
                )}
              </span>
              <span className="mic-label">{isListening ? 'Tap to stop' : 'Tap to speak'}</span>
            </button>

            {!isSupported && (
              <p className="text-muted" style={{ textAlign: 'center', marginTop: 8 }}>
                Voice not available — use Chrome or Edge
              </p>
            )}

            {voiceError && <p className="error-text">{voiceError}</p>}

            {isListening && (
              <div className="listening-indicator">
                <span className="pulse-dot" />
                <span>Listening…</span>
              </div>
            )}
          </div>

          {/* Transcript display / manual edit */}
          <div className="form-group">
            <label className="form-label">Situation</label>
            <textarea
              className="form-textarea transcript-box"
              placeholder="Speak above or type your situation here…&#10;e.g. '142 yards to the pin, flag is back right, bunker short right, wind off the left'"
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              rows={4}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading || !transcript.trim()}
          >
            {loading ? 'Thinking…' : (
              <>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <line x1="7.5" y1="13" x2="7.5" y2="5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <polygon points="7.5,5 12,7.2 7.5,9.4" fill="currentColor"/>
                  <ellipse cx="7.5" cy="13.3" rx="3.5" ry="1.2" stroke="currentColor" strokeWidth="1.3" fill="none" opacity="0.6"/>
                </svg>
                Get Recommendation
              </>
            )}
          </button>

          {apiError && (
            <div className="error-card">
              <strong>Error:</strong> {apiError}
            </div>
          )}

          {/* Recommendation */}
          {recommendation && (
            <div className="card recommendation-card">
              <RecommendationDisplay text={recommendation} />
            </div>
          )}

          {/* Feedback */}
          {showFeedback && !feedbackSaved && (
            <div className="card feedback-card">
              <h3 className="feedback-title">How was this suggestion?</h3>
              <StarRating value={rating} onChange={setRating} />
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Club you actually hit</label>
                <input
                  className="form-input"
                  placeholder="e.g. 8-iron"
                  value={clubUsed}
                  onChange={e => setClubUsed(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">What happened?</label>
                <input
                  className="form-input"
                  placeholder="e.g. hit green, 10 feet short"
                  value={outcome}
                  onChange={e => setOutcome(e.target.value)}
                />
              </div>
              <button className="btn btn-secondary" onClick={handleFeedbackSave}>
                Save Shot
              </button>
            </div>
          )}

          {feedbackSaved && (
            <div className="success-banner">Shot saved to history ✓</div>
          )}
        </>
      )}

      {/* ── ROUND MODE ── */}
      {caddieMode === 'round' && (
        <>
          {allCourseHoles.length === 0 && selectedCourse && (
            <p className="text-muted" style={{ fontSize: 13, textAlign: 'center', margin: '8px 0 12px' }}>
              No hole data for this course — strategy will be based on your profile and conditions.
            </p>
          )}

          <button
            className="btn btn-primary"
            onClick={handleRoundStrategy}
            disabled={roundStrategyLoading || !selectedCourse}
          >
            {roundStrategyLoading ? 'Building game plan…' : '🗺️ Get Round Strategy'}
          </button>

          {apiError && (
            <div className="error-card">
              <strong>Error:</strong> {apiError}
            </div>
          )}

          {roundStrategy && (
            <div className="card recommendation-card">
              <RecommendationDisplay text={roundStrategy} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
