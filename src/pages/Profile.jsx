import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import '../styles/Profile.css'

const DEFAULT_CLUBS = [
  'Driver', '3-wood', '5-wood', '4-hybrid', '5-hybrid',
  '4-iron', '5-iron', '6-iron', '7-iron', '8-iron', '9-iron',
  'PW', 'GW', 'SW', 'LW'
]

export default function Profile() {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [handicapCalc, setHandicapCalc] = useState(null)
  const [handicapExpanded, setHandicapExpanded] = useState(false)
  const [applyingHandicap, setApplyingHandicap] = useState(false)

  const [profile, setProfile] = useState({
    ball_flight: 'straight',
    general_tendency: '',
    handicap: '',
    home_course: '',
  })

  const [clubs, setClubs] = useState(
    DEFAULT_CLUBS.map(name => ({ club_name: name, carry_distance: '', miss_tendency: '', notes: '' }))
  )

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profileData } = await supabase
      .from('player_profile')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileData) {
      setProfile({
        ball_flight: profileData.ball_flight || 'straight',
        general_tendency: profileData.general_tendency || '',
        handicap: profileData.handicap ?? '',
        home_course: profileData.home_course || '',
      })
    }

    const { data: clubData } = await supabase
      .from('club_profiles')
      .select('*')
      .eq('user_id', user.id)

    if (clubData && clubData.length > 0) {
      setClubs(DEFAULT_CLUBS.map(name => {
        const existing = clubData.find(c => c.club_name === name)
        return existing
          ? { club_name: name, carry_distance: existing.carry_distance ?? '', miss_tendency: existing.miss_tendency || '', notes: existing.notes || '' }
          : { club_name: name, carry_distance: '', miss_tendency: '', notes: '' }
      }))
    }

    await loadHandicap(user.id)
    setLoading(false)
  }

  async function loadHandicap(userId) {
    const { data: rounds } = await supabase
      .from('rounds')
      .select('id, date, course_name, score, course_rating, slope_rating')
      .eq('user_id', userId)
      .not('score', 'is', null)
      .order('date', { ascending: false })
      .limit(20)

    const MIN_ROUNDS = 5

    if (!rounds || rounds.length === 0) {
      setHandicapCalc({ index: null, qualifying: [], best8: [], skipped: 0, minRounds: MIN_ROUNDS })
      return
    }

    const qualifying = []
    let skipped = 0
    rounds.forEach(r => {
      if (r.course_rating != null && r.slope_rating != null) {
        qualifying.push({
          ...r,
          differential: Math.round(((r.score - r.course_rating) * 113 / r.slope_rating) * 10) / 10,
        })
      } else {
        skipped++
      }
    })

    const sorted = [...qualifying].sort((a, b) => a.differential - b.differential)

    if (sorted.length < MIN_ROUNDS) {
      setHandicapCalc({ index: null, qualifying: sorted, best8: [], skipped, minRounds: MIN_ROUNDS })
      return
    }

    const best8 = sorted.slice(0, Math.min(8, sorted.length))
    const avg = best8.reduce((sum, r) => sum + r.differential, 0) / best8.length
    const index = Math.round(avg * 10) / 10

    setHandicapCalc({ index, qualifying: sorted, best8, skipped, minRounds: MIN_ROUNDS })
  }

  async function applyCalculatedHandicap() {
    if (!handicapCalc?.index) return
    setApplyingHandicap(true)
    const rounded = Math.round(handicapCalc.index)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('player_profile').upsert({
        user_id: user.id,
        handicap: rounded,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      setProfile(p => ({ ...p, handicap: String(rounded) }))
    }
    setApplyingHandicap(false)
  }

  function updateClub(index, field, value) {
    setClubs(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('You must be logged in to save your profile.')
      setSaving(false)
      return
    }

    // Upsert player profile
    await supabase.from('player_profile').upsert({
      user_id: user.id,
      ball_flight: profile.ball_flight,
      general_tendency: profile.general_tendency,
      handicap: profile.handicap !== '' ? parseInt(profile.handicap) : null,
      home_course: profile.home_course,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    // Delete existing clubs and re-insert (simplest approach)
    await supabase.from('club_profiles').delete().eq('user_id', user.id)

    const clubRows = clubs
      .filter(c => c.carry_distance !== '' && c.carry_distance !== null)
      .map(c => ({
        user_id: user.id,
        club_name: c.club_name,
        carry_distance: parseInt(c.carry_distance),
        miss_tendency: c.miss_tendency || null,
        notes: c.notes || null,
      }))

    if (clubRows.length > 0) {
      await supabase.from('club_profiles').insert(clubRows)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div className="page"><p className="text-muted">Loading…</p></div>

  return (
    <div className="page profile-page">
      <div className="page-header">
        <h1 className="page-title">Player Profile</h1>
        <p className="page-subtitle">Your bag and tendencies</p>
      </div>

      <div className="card">
        <h2 className="section-title">General Info</h2>

        <div className="form-group">
          <label className="form-label">Ball Flight</label>
          <select
            className="form-select"
            value={profile.ball_flight}
            onChange={e => setProfile(p => ({ ...p, ball_flight: e.target.value }))}
          >
            <option value="straight">Straight</option>
            <option value="draw">Draw</option>
            <option value="fade">Fade</option>
            <option value="strong draw">Strong draw</option>
            <option value="strong fade">Strong fade</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Handicap</label>
          <input
            className="form-input"
            type="number"
            min="0"
            max="54"
            placeholder="e.g. 14"
            value={profile.handicap}
            onChange={e => setProfile(p => ({ ...p, handicap: e.target.value }))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Home Course</label>
          <input
            className="form-input"
            placeholder="e.g. Pebble Beach"
            value={profile.home_course}
            onChange={e => setProfile(p => ({ ...p, home_course: e.target.value }))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">General Tendencies / Notes</label>
          <textarea
            className="form-textarea"
            placeholder="e.g. Tend to chunk short irons when nervous, strong off the tee, miss right under pressure"
            value={profile.general_tendency}
            onChange={e => setProfile(p => ({ ...p, general_tendency: e.target.value }))}
            rows={3}
          />
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Club Distances</h2>
        <p className="text-muted" style={{ marginBottom: 14 }}>Enter carry distance in yards. Leave blank for clubs not in your bag.</p>

        <div className="club-header-row">
          <span className="club-col-label">Club</span>
          <span className="club-col-label">Carry (yds)</span>
          <span className="club-col-label">Miss tendency</span>
        </div>

        {clubs.map((club, i) => (
          <div key={club.club_name} className="club-row">
            <span className="club-name">{club.club_name}</span>
            <input
              className="form-input club-input-small"
              type="number"
              min="0"
              max="400"
              placeholder="—"
              value={club.carry_distance}
              onChange={e => updateClub(i, 'carry_distance', e.target.value)}
            />
            <input
              className="form-input club-input-miss"
              placeholder="e.g. thin right"
              value={club.miss_tendency}
              onChange={e => updateClub(i, 'miss_tendency', e.target.value)}
            />
          </div>
        ))}
      </div>

      {handicapCalc !== null && (
        <div className="card">
          <h2 className="section-title">Handicap Calculator</h2>
          {handicapCalc.index !== null ? (
            <>
              <div className="handicap-index-display">
                <span className="handicap-index-num">{handicapCalc.index}</span>
                <span className="handicap-index-label">Handicap Index (USGA)</span>
              </div>
              <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
                Best {handicapCalc.best8.length} of {handicapCalc.qualifying.length} qualifying round{handicapCalc.qualifying.length !== 1 ? 's' : ''}
                {handicapCalc.skipped > 0 ? ` · ${handicapCalc.skipped} skipped (missing rating/slope)` : ''}.
              </p>
              <button
                className="btn btn-secondary"
                style={{ width: '100%', marginBottom: 8 }}
                onClick={applyCalculatedHandicap}
                disabled={applyingHandicap}
              >
                {applyingHandicap ? 'Saving…' : `Use ${handicapCalc.index} as my handicap`}
              </button>
              <p className="text-muted" style={{ fontSize: 11, marginBottom: 14 }}>
                Stored as {Math.round(handicapCalc.index)} (rounded to integer) in your profile.
              </p>
              <button
                className="btn btn-secondary"
                style={{ width: '100%', fontSize: 13 }}
                onClick={() => setHandicapExpanded(e => !e)}
              >
                {handicapExpanded ? '▲ Hide rounds used' : '▼ Show rounds used'}
              </button>
              {handicapExpanded && (
                <div className="differential-list">
                  {handicapCalc.best8.map(r => (
                    <div key={r.id} className="differential-row">
                      <span className="diff-course">{r.course_name || 'Unknown'}</span>
                      <span className="diff-date text-muted">{r.date}</span>
                      <span className="diff-score text-muted">{r.score}</span>
                      <span className={`diff-val ${r.differential <= 0 ? 'text-gold' : ''}`}>
                        {r.differential > 0 ? '+' : ''}{r.differential}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-muted" style={{ marginBottom: handicapCalc.skipped > 0 ? 10 : 0 }}>
                Need at least {handicapCalc.minRounds} qualifying rounds (with course rating &amp; slope) to calculate.
                {handicapCalc.qualifying.length > 0
                  ? ` You have ${handicapCalc.qualifying.length} so far.`
                  : ' No qualifying rounds yet — start tracking rounds in the Score tab.'}
              </p>
              {handicapCalc.skipped > 0 && (
                <p className="text-muted">
                  {handicapCalc.skipped} round{handicapCalc.skipped !== 1 ? 's' : ''} skipped — missing course rating or slope.
                  Add these in the Score tab when recording rounds.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Profile'}
      </button>

      {saved && <div className="success-banner" style={{ marginTop: 12 }}>Profile saved ✓</div>}
    </div>
  )
}
