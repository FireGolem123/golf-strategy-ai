import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getClubRecommendation } from '../lib/claude'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { useCourseData } from '../hooks/useCourseData'
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

function RecommendationDisplay({ text }) {
  // Render the structured response with section highlighting
  const lines = text.split('\n')
  return (
    <div className="recommendation">
      {lines.map((line, i) => {
        if (line.startsWith('🏌️') || line.startsWith('✅') || line.startsWith('⚠️') || line.startsWith('🌦️')) {
          return <p key={i} className="rec-section-header">{line}</p>
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
  const [recommendation, setRecommendation] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [activeRoundId, setActiveRoundId] = useState(null)

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
  }, [])

  async function loadInitialData() {
    const { data: { user } } = await supabase.auth.getUser()

    // Load course names
    const { data: holes } = await supabase
      .from('course_holes')
      .select('course_name')
    if (holes) {
      const unique = [...new Set(holes.map(h => h.course_name))]
      setCourseNames(unique)
    }

    if (!user) return

    // Load player profile
    const { data: profile } = await supabase
      .from('player_profile')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    setPlayerProfile(profile)

    // Load club profiles
    const { data: clubs } = await supabase
      .from('club_profiles')
      .select('*')
      .eq('user_id', user.id)
      .order('carry_distance', { ascending: false })
    setClubProfiles(clubs || [])

    // Get or create today's round
    const today = new Date().toISOString().split('T')[0]
    const { data: existingRound } = await supabase
      .from('rounds')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle()

    if (existingRound) {
      setActiveRoundId(existingRound.id)
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
      const result = await getClubRecommendation(transcript, playerProfile, clubProfiles, courseHole)
      setRecommendation(result)
      setShowFeedback(true)
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleFeedbackSave() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Ensure we have a round for today
    let roundId = activeRoundId
    if (!roundId) {
      const today = new Date().toISOString().split('T')[0]
      const { data: round } = await supabase
        .from('rounds')
        .insert({
          user_id: user.id,
          course_name: selectedCourse || null,
          date: today,
        })
        .select('id')
        .single()
      if (round) {
        roundId = round.id
        setActiveRoundId(round.id)
      }
    }

    // Extract suggested club from recommendation text
    const clubMatch = recommendation.match(/Club:\s*([^\n]+)/)
    const suggestedClub = clubMatch ? clubMatch[1].trim() : null

    await supabase.from('shot_history').insert({
      user_id: user.id,
      round_id: roundId,
      hole_number: selectedHole ? parseInt(selectedHole) : null,
      distance_to_pin: null,
      club_suggested: suggestedClub,
      club_used: clubUsed || null,
      suggestion_rating: rating || null,
      outcome: outcome || null,
      conditions_noted: transcript,
    })

    setFeedbackSaved(true)
  }

  const handleMicToggle = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  return (
    <div className="page home-page">
      <div className="home-header">
        <h1 className="home-title">⛳ Golf Strategy AI</h1>
        <p className="home-subtitle">Your AI caddie</p>
      </div>

      {/* Course & Hole selectors */}
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
      </div>

      {/* Course hole info badge */}
      {courseHole && (
        <div className="hole-info-badge">
          <span>Hole {courseHole.hole_number} · Par {courseHole.par}</span>
          {courseHole.hazards && <span className="hole-hazard">⚠ {courseHole.hazards}</span>}
        </div>
      )}

      {/* Voice input */}
      <div className="voice-section">
        <button
          className={`mic-button ${isListening ? 'listening' : ''}`}
          onClick={handleMicToggle}
          disabled={!isSupported}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
          <span className="mic-icon">{isListening ? '⏹' : '🎙'}</span>
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
        {loading ? 'Thinking…' : '⛳ Get Recommendation'}
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
    </div>
  )
}
