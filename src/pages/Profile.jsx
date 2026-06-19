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

    setLoading(false)
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

      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Profile'}
      </button>

      {saved && <div className="success-banner" style={{ marginTop: 12 }}>Profile saved ✓</div>}
    </div>
  )
}
