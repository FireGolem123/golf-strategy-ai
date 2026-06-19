import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import '../styles/History.css'

function StarDisplay({ value }) {
  return (
    <span className="star-display">
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} style={{ color: s <= value ? 'var(--gold)' : 'var(--green-700)' }}>★</span>
      ))}
    </span>
  )
}

function RoundCard({ round, shots }) {
  const [expanded, setExpanded] = useState(false)

  const ratedShots = shots.filter(s => s.suggestion_rating)
  const avgRating = ratedShots.length > 0
    ? (ratedShots.reduce((sum, s) => sum + s.suggestion_rating, 0) / ratedShots.length).toFixed(1)
    : null

  const outcomes = shots.filter(s => s.outcome).map(s => s.outcome)
  const outcomeCounts = outcomes.reduce((acc, o) => {
    acc[o] = (acc[o] || 0) + 1
    return acc
  }, {})
  const topOutcome = Object.entries(outcomeCounts).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="round-card card">
      <button className="round-header" onClick={() => setExpanded(e => !e)}>
        <div className="round-header-left">
          <span className="round-course">{round.course_name || 'Unknown course'}</span>
          <span className="round-date text-muted">{round.date}</span>
        </div>
        <div className="round-header-right">
          {round.score && <span className="round-score">{round.score}</span>}
          <span className="round-shots text-muted">{shots.length} shots</span>
          <span className="round-chevron">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Summary stats */}
      <div className="round-stats">
        {avgRating && (
          <div className="round-stat">
            <span className="stat-label">Avg rating</span>
            <span className="stat-value text-gold">{avgRating}/5</span>
          </div>
        )}
        {topOutcome && (
          <div className="round-stat">
            <span className="stat-label">Common outcome</span>
            <span className="stat-value">{topOutcome[0]} ({topOutcome[1]}x)</span>
          </div>
        )}
        {round.notes && (
          <div className="round-stat">
            <span className="stat-label">Notes</span>
            <span className="stat-value text-muted">{round.notes}</span>
          </div>
        )}
      </div>

      {expanded && shots.length > 0 && (
        <div className="shot-list">
          <hr className="divider" />
          {shots.map(shot => (
            <div key={shot.id} className="shot-row">
              <div className="shot-meta">
                {shot.hole_number && <span className="shot-hole">Hole {shot.hole_number}</span>}
                {shot.distance_to_pin && <span className="text-muted">{shot.distance_to_pin} yds</span>}
              </div>
              <div className="shot-clubs">
                {shot.club_suggested && (
                  <span className="shot-label">Suggested: <strong>{shot.club_suggested}</strong></span>
                )}
                {shot.club_used && (
                  <span className="shot-label">Hit: <strong>{shot.club_used}</strong></span>
                )}
              </div>
              {shot.outcome && <p className="shot-outcome">{shot.outcome}</p>}
              {shot.suggestion_rating && <StarDisplay value={shot.suggestion_rating} />}
            </div>
          ))}
        </div>
      )}

      {expanded && shots.length === 0 && (
        <p className="text-muted" style={{ marginTop: 12, fontSize: 13 }}>No shots recorded for this round.</p>
      )}
    </div>
  )
}

export default function History() {
  const [rounds, setRounds] = useState([])
  const [shotsByRound, setShotsByRound] = useState({})
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalShots: 0, avgRating: null })

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: roundsData } = await supabase
      .from('rounds')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    const { data: shotsData } = await supabase
      .from('shot_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    const roundList = roundsData || []
    const shotList = shotsData || []

    // Group shots by round
    const grouped = {}
    roundList.forEach(r => { grouped[r.id] = [] })
    shotList.forEach(s => {
      if (s.round_id && grouped[s.round_id]) {
        grouped[s.round_id].push(s)
      }
    })

    // Also include shots without a round_id (saved from Home page without a round)
    const orphaned = shotList.filter(s => !s.round_id)

    setRounds(roundList)
    setShotsByRound(grouped)

    // Global stats
    const ratedShots = shotList.filter(s => s.suggestion_rating)
    setStats({
      totalShots: shotList.length,
      avgRating: ratedShots.length > 0
        ? (ratedShots.reduce((sum, s) => sum + s.suggestion_rating, 0) / ratedShots.length).toFixed(1)
        : null,
    })

    setLoading(false)
  }

  if (loading) return <div className="page"><p className="text-muted">Loading history…</p></div>

  return (
    <div className="page history-page">
      <div className="page-header">
        <h1 className="page-title">Shot History</h1>
        <p className="page-subtitle">Your rounds and caddie ratings</p>
      </div>

      {/* Global stats bar */}
      {stats.totalShots > 0 && (
        <div className="card stats-bar">
          <div className="global-stat">
            <span className="stat-num">{stats.totalShots}</span>
            <span className="stat-desc text-muted">shots tracked</span>
          </div>
          {stats.avgRating && (
            <div className="global-stat">
              <span className="stat-num text-gold">{stats.avgRating}</span>
              <span className="stat-desc text-muted">avg caddie rating</span>
            </div>
          )}
          <div className="global-stat">
            <span className="stat-num">{rounds.length}</span>
            <span className="stat-desc text-muted">rounds</span>
          </div>
        </div>
      )}

      {rounds.length === 0 ? (
        <div className="empty-state card">
          <p>No rounds yet. Your shot history will appear here after using the Caddie tab.</p>
        </div>
      ) : (
        rounds.map(round => (
          <RoundCard
            key={round.id}
            round={round}
            shots={shotsByRound[round.id] || []}
          />
        ))
      )}
    </div>
  )
}
