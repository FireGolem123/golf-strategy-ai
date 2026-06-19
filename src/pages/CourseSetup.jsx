import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import '../styles/CourseSetup.css'

const HOLES = Array.from({ length: 18 }, (_, i) => i + 1)

const EMPTY_HOLE = {
  par: '4',
  yardage_black: '',
  yardage_blue: '',
  yardage_white: '',
  hazards: '',
  green_notes: '',
  personal_notes: '',
}

export default function CourseSetup() {
  const [courseName, setCourseName] = useState('')
  const [selectedHole, setSelectedHole] = useState('1')
  const [holeData, setHoleData] = useState(EMPTY_HOLE)
  const [existingHoles, setExistingHoles] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  // Reload hole list when course changes
  useEffect(() => {
    if (courseName.trim()) {
      loadExistingHoles(courseName)
    } else {
      setExistingHoles([])
    }
  }, [courseName])

  // Load selected hole data when hole changes
  useEffect(() => {
    if (courseName.trim() && selectedHole) {
      loadHole(courseName, parseInt(selectedHole))
    }
  }, [courseName, selectedHole])

  async function loadExistingHoles(name) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('course_holes')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_name', name)
      .order('hole_number')

    setExistingHoles(data || [])
  }

  async function loadHole(name, holeNum) {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('course_holes')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_name', name)
      .eq('hole_number', holeNum)
      .maybeSingle()

    if (data) {
      setHoleData({
        par: data.par ?? '4',
        yardage_black: data.yardage_black ?? '',
        yardage_blue: data.yardage_blue ?? '',
        yardage_white: data.yardage_white ?? '',
        hazards: data.hazards || '',
        green_notes: data.green_notes || '',
        personal_notes: data.personal_notes || '',
      })
    } else {
      setHoleData(EMPTY_HOLE)
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!courseName.trim()) {
      alert('Enter a course name first.')
      return
    }

    setSaving(true)
    setSaved(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('You must be logged in to save course data.')
      setSaving(false)
      return
    }

    const row = {
      user_id: user.id,
      course_name: courseName.trim(),
      hole_number: parseInt(selectedHole),
      par: parseInt(holeData.par) || null,
      yardage_black: holeData.yardage_black !== '' ? parseInt(holeData.yardage_black) : null,
      yardage_blue: holeData.yardage_blue !== '' ? parseInt(holeData.yardage_blue) : null,
      yardage_white: holeData.yardage_white !== '' ? parseInt(holeData.yardage_white) : null,
      hazards: holeData.hazards || null,
      green_notes: holeData.green_notes || null,
      personal_notes: holeData.personal_notes || null,
    }

    // Upsert using unique constraint on (user_id, course_name, hole_number)
    const { error } = await supabase
      .from('course_holes')
      .upsert(row, { onConflict: 'user_id,course_name,hole_number' })

    if (error) {
      alert('Save failed: ' + error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      loadExistingHoles(courseName)
    }

    setSaving(false)
  }

  async function handleDeleteHole(holeNum) {
    if (!confirm(`Delete hole ${holeNum} data for ${courseName}?`)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('course_holes')
      .delete()
      .eq('user_id', user.id)
      .eq('course_name', courseName)
      .eq('hole_number', holeNum)

    loadExistingHoles(courseName)
    if (parseInt(selectedHole) === holeNum) {
      setHoleData(EMPTY_HOLE)
    }
  }

  return (
    <div className="page course-page">
      <div className="page-header">
        <h1 className="page-title">Course Setup</h1>
        <p className="page-subtitle">Build your course yardage book</p>
      </div>

      <div className="card">
        <div className="form-group">
          <label className="form-label">Course Name</label>
          <input
            className="form-input"
            placeholder="e.g. Augusta National"
            value={courseName}
            onChange={e => setCourseName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Hole</label>
          <div className="hole-tabs">
            {HOLES.map(h => {
              const hasData = existingHoles.some(e => e.hole_number === h)
              return (
                <button
                  key={h}
                  className={`hole-tab ${selectedHole === String(h) ? 'active' : ''} ${hasData ? 'has-data' : ''}`}
                  onClick={() => setSelectedHole(String(h))}
                >
                  {h}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="card">
          <h2 className="section-title">Hole {selectedHole} Details</h2>

          <div className="form-row">
            <div className="form-group form-row-item">
              <label className="form-label">Par</label>
              <select
                className="form-select"
                value={holeData.par}
                onChange={e => setHoleData(d => ({ ...d, par: e.target.value }))}
              >
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </div>
            <div className="form-group form-row-item">
              <label className="form-label">Black (yds)</label>
              <input className="form-input" type="number" placeholder="—" value={holeData.yardage_black}
                onChange={e => setHoleData(d => ({ ...d, yardage_black: e.target.value }))} />
            </div>
            <div className="form-group form-row-item">
              <label className="form-label">Blue (yds)</label>
              <input className="form-input" type="number" placeholder="—" value={holeData.yardage_blue}
                onChange={e => setHoleData(d => ({ ...d, yardage_blue: e.target.value }))} />
            </div>
            <div className="form-group form-row-item">
              <label className="form-label">White (yds)</label>
              <input className="form-input" type="number" placeholder="—" value={holeData.yardage_white}
                onChange={e => setHoleData(d => ({ ...d, yardage_white: e.target.value }))} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Hazards</label>
            <textarea
              className="form-textarea"
              placeholder="e.g. bunkers front right, water left of green, OB behind green"
              value={holeData.hazards}
              onChange={e => setHoleData(d => ({ ...d, hazards: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Green Notes</label>
            <textarea
              className="form-textarea"
              placeholder="e.g. slopes back to front, fast, two-tier, pin usually back right Sunday"
              value={holeData.green_notes}
              onChange={e => setHoleData(d => ({ ...d, green_notes: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Personal Notes</label>
            <textarea
              className="form-textarea"
              placeholder="e.g. always miss right here — aim at left edge of green. Take one more club."
              value={holeData.personal_notes}
              onChange={e => setHoleData(d => ({ ...d, personal_notes: e.target.value }))}
              rows={2}
            />
          </div>

          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !courseName.trim()}>
            {saving ? 'Saving…' : `Save Hole ${selectedHole}`}
          </button>

          {saved && <div className="success-banner" style={{ marginTop: 12 }}>Hole {selectedHole} saved ✓</div>}
        </div>
      )}

      {/* Existing holes list */}
      {existingHoles.length > 0 && (
        <div className="card">
          <h2 className="section-title">{courseName} — Saved Holes</h2>
          {existingHoles.map(hole => (
            <div key={hole.id} className="hole-list-item">
              <div className="hole-list-info">
                <span className="hole-list-num">Hole {hole.hole_number}</span>
                <span className="hole-list-par text-muted">Par {hole.par}</span>
                {hole.yardage_white && <span className="text-muted">{hole.yardage_white} yds (white)</span>}
              </div>
              <div className="hole-list-actions">
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => { setSelectedHole(String(hole.hole_number)) }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => handleDeleteHole(hole.hole_number)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
