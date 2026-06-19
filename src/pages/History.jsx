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

function RoundCard({ round, shots, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({})

  const ratedShots = shots.filter(s => s.suggestion_rating)
  const avgRating = ratedShots.length > 0
    ? (ratedShots.reduce((sum, s) => sum + s.suggestion_rating, 0) / ratedShots.length).toFixed(1)
    : null

  const outcomes = shots.filter(s => s.outcome).map(s => s.outcome)
  const outcomeCounts = outcomes.reduce((acc, o) => { acc[o] = (acc[o] || 0) + 1; return acc }, {})
  const topOutcome = Object.entries(outcomeCounts).sort((a, b) => b[1] - a[1])[0]

  function startEdit() {
    setEditForm({
      course_name: round.course_name || '',
      date: round.date || '',
      score: round.score ?? '',
      tee_name: round.tee_name || '',
      course_rating: round.course_rating ?? '',
      slope_rating: round.slope_rating ?? '',
      notes: round.notes || '',
    })
    setEditing(true)
    setExpanded(true)
    setConfirmDelete(false)
  }

  async function handleSave() {
    setSaving(true)
    await onUpdate(round.id, {
      course_name: editForm.course_name.trim() || null,
      date: editForm.date || null,
      score: editForm.score !== '' ? parseInt(editForm.score) : null,
      tee_name: editForm.tee_name.trim() || null,
      course_rating: editForm.course_rating !== '' ? parseFloat(editForm.course_rating) : null,
      slope_rating: editForm.slope_rating !== '' ? parseInt(editForm.slope_rating) : null,
      notes: editForm.notes.trim() || null,
    })
    setSaving(false)
    setEditing(false)
  }

  // ── Edit mode ────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="round-card card round-editing">
        <div className="round-edit-header">
          <span className="round-edit-title">Edit Round</span>
          <span className="text-muted" style={{ fontSize: 12 }}>{round.course_name} · {round.date}</span>
        </div>

        <div className="edit-row">
          <div className="form-group" style={{ flex: 2, minWidth: 0 }}>
            <label className="form-label">Course</label>
            <input className="form-input" value={editForm.course_name}
              onChange={e => setEditForm(f => ({ ...f, course_name: e.target.value }))} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={editForm.date}
              onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
          </div>
        </div>

        <div className="edit-row">
          <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
            <label className="form-label">Score</label>
            <input className="form-input" type="number" placeholder="—" value={editForm.score}
              onChange={e => setEditForm(f => ({ ...f, score: e.target.value }))} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
            <label className="form-label">Tee</label>
            <input className="form-input" placeholder="e.g. White" value={editForm.tee_name}
              onChange={e => setEditForm(f => ({ ...f, tee_name: e.target.value }))} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
            <label className="form-label">Rating</label>
            <input className="form-input" type="number" step="0.1" placeholder="71.4" value={editForm.course_rating}
              onChange={e => setEditForm(f => ({ ...f, course_rating: e.target.value }))} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
            <label className="form-label">Slope</label>
            <input className="form-input" type="number" placeholder="113" value={editForm.slope_rating}
              onChange={e => setEditForm(f => ({ ...f, slope_rating: e.target.value }))} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" rows={2} value={editForm.notes}
            onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
        </div>

        <div className="edit-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button className="btn btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // ── Normal display ───────────────────────────────────────────────
  return (
    <div className="round-card card">
      <button className="round-header" onClick={() => { setExpanded(e => !e); setConfirmDelete(false) }}>
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
        {round.tee_name && (
          <div className="round-stat">
            <span className="stat-label">Tees</span>
            <span className="stat-value">{round.tee_name}</span>
          </div>
        )}
        {round.notes && (
          <div className="round-stat">
            <span className="stat-label">Notes</span>
            <span className="stat-value text-muted">{round.notes}</span>
          </div>
        )}
      </div>

      {expanded && (
        <>
          {shots.length > 0 && (
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

          {shots.length === 0 && (
            <p className="text-muted" style={{ marginTop: 12, fontSize: 13 }}>No shots recorded for this round.</p>
          )}

          {/* Action bar */}
          <div className="round-actions">
            <button className="btn btn-secondary round-action-btn" onClick={startEdit}>
              Edit round
            </button>
            {!confirmDelete ? (
              <button className="btn btn-danger round-action-btn" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            ) : (
              <div className="delete-confirm">
                <span className="delete-confirm-label">Delete this round?</span>
                <button className="btn btn-danger round-action-btn" onClick={() => onDelete(round.id)}>
                  Yes, delete
                </button>
                <button className="btn btn-secondary round-action-btn" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function History() {
  const [rounds, setRounds] = useState([])
  const [shotsByRound, setShotsByRound] = useState({})
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalShots: 0, avgRating: null })

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: roundsData } = await supabase
      .from('rounds').select('*').eq('user_id', user.id)
      .order('date', { ascending: false })

    const { data: shotsData } = await supabase
      .from('shot_history').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: true })

    const roundList = roundsData || []
    const shotList = shotsData || []

    const grouped = {}
    roundList.forEach(r => { grouped[r.id] = [] })
    shotList.forEach(s => {
      if (s.round_id && grouped[s.round_id]) grouped[s.round_id].push(s)
    })

    setRounds(roundList)
    setShotsByRound(grouped)

    const ratedShots = shotList.filter(s => s.suggestion_rating)
    setStats({
      totalShots: shotList.length,
      avgRating: ratedShots.length > 0
        ? (ratedShots.reduce((sum, s) => sum + s.suggestion_rating, 0) / ratedShots.length).toFixed(1)
        : null,
    })

    setLoading(false)
  }

  async function handleUpdateRound(id, updates) {
    const { error } = await supabase.from('rounds').update(updates).eq('id', id)
    if (!error) {
      setRounds(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
    }
  }

  async function handleDeleteRound(id) {
    const { error } = await supabase.from('rounds').delete().eq('id', id)
    if (!error) {
      setRounds(prev => prev.filter(r => r.id !== id))
      setShotsByRound(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }

  if (loading) return <div className="page"><p className="text-muted">Loading history…</p></div>

  return (
    <div className="page history-page">
      <div className="page-header">
        <h1 className="page-title">Shot History</h1>
        <p className="page-subtitle">Your rounds and caddie ratings</p>
      </div>

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
            onUpdate={handleUpdateRound}
            onDelete={handleDeleteRound}
          />
        ))
      )}
    </div>
  )
}
