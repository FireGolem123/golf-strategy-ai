import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { searchCourses, getCourseById } from '../lib/golfCourseApi'
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

// Flexible tees lookup — handles male/Male/MALE/mens etc.
function getTeesForGender(tees, gender) {
  if (!tees || typeof tees !== 'object') return []
  // Try exact key first, then capitalized, then case-insensitive scan
  if (Array.isArray(tees[gender])) return tees[gender]
  const cap = gender.charAt(0).toUpperCase() + gender.slice(1)
  if (Array.isArray(tees[cap])) return tees[cap]
  for (const [k, v] of Object.entries(tees)) {
    if (k.toLowerCase() === gender && Array.isArray(v)) return v
  }
  return []
}

// Map a tee name to the yardage column it best fits
function teeToYardageCol(teeName) {
  const n = (teeName || '').toLowerCase()
  if (n.includes('black') || n.includes('champion') || n.includes('tournament') || n.includes('gold')) return 'yardage_black'
  if (n.includes('white') || n.includes('middle') || n.includes("men")) return 'yardage_white'
  return 'yardage_blue'
}

export default function CourseSetup() {
  // ── Manual entry state ─────────────────────────────────────────
  const [courseName, setCourseName] = useState('')
  const [selectedHole, setSelectedHole] = useState('1')
  const [holeData, setHoleData] = useState(EMPTY_HOLE)
  const [existingHoles, setExistingHoles] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  // ── Search + import state ──────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)

  const [importCourse, setImportCourse] = useState(null)       // full Course object
  const [importCourseName, setImportCourseName] = useState('') // editable save-as name
  const [importGender, setImportGender] = useState('male')
  const [importTeeName, setImportTeeName] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importSuccess, setImportSuccess] = useState(false)

  // Derived: current tee box selection
  const availableTees = getTeesForGender(importCourse?.tees, importGender)
  const selectedTeeBox = availableTees.find(t => t.tee_name === importTeeName) || null

  // ── Manual entry effects ───────────────────────────────────────
  useEffect(() => {
    if (courseName.trim()) loadExistingHoles(courseName)
    else setExistingHoles([])
  }, [courseName])

  useEffect(() => {
    if (courseName.trim() && selectedHole) loadHole(courseName, parseInt(selectedHole))
  }, [courseName, selectedHole])

  // When gender changes, reset tee selection to first available
  useEffect(() => {
    const tees = importCourse?.tees?.[importGender] || []
    setImportTeeName(tees[0]?.tee_name || '')
  }, [importGender, importCourse])

  // ── Manual entry functions ─────────────────────────────────────
  async function loadExistingHoles(name) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('course_holes').select('*').eq('user_id', user.id)
      .eq('course_name', name).order('hole_number')
    setExistingHoles(data || [])
  }

  async function loadHole(name, holeNum) {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('course_holes').select('*').eq('user_id', user.id)
      .eq('course_name', name).eq('hole_number', holeNum).maybeSingle()
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
    if (!courseName.trim()) { alert('Enter a course name first.'); return }
    setSaving(true); setSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Not logged in.'); setSaving(false); return }

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

    const { error } = await supabase
      .from('course_holes').upsert(row, { onConflict: 'user_id,course_name,hole_number' })

    if (error) { alert('Save failed: ' + error.message) }
    else {
      setSaved(true); setTimeout(() => setSaved(false), 2500)
      loadExistingHoles(courseName)
    }
    setSaving(false)
  }

  async function handleDeleteHole(holeNum) {
    if (!confirm(`Delete hole ${holeNum} data for ${courseName}?`)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('course_holes').delete()
      .eq('user_id', user.id).eq('course_name', courseName).eq('hole_number', holeNum)
    loadExistingHoles(courseName)
    if (parseInt(selectedHole) === holeNum) setHoleData(EMPTY_HOLE)
  }

  // ── Search + import functions ──────────────────────────────────
  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearchLoading(true); setSearchError(null); setSearchResults([])
    try {
      const results = await searchCourses(searchQuery)
      if (results.length === 0) setSearchError('No courses found — try a different name or use manual entry below.')
      else setSearchResults(results)
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearchLoading(false)
    }
  }

  async function handleSelectResult(course) {
    setImportLoading(true); setImportError(null); setSearchResults([])
    try {
      // The spec says search returns full Course objects, so check if tees are already present
      const hasTees = course.tees && typeof course.tees === 'object' &&
        Object.values(course.tees).some(v => Array.isArray(v) && v.length > 0)

      let full = hasTees ? course : await getCourseById(course.id)
      if (!full) throw new Error('Course details not found.')

      const derivedName = (full.course_name && full.course_name !== full.club_name)
        ? `${full.club_name} — ${full.course_name}`
        : (full.club_name || full.course_name || '')

      setImportCourse(full)
      setImportCourseName(derivedName)
      setImportGender('male')
    } catch (err) {
      setImportError(err.message)
    } finally {
      setImportLoading(false)
    }
  }

  async function handleImport() {
    if (!selectedTeeBox) { setImportError('Select a tee first.'); return }
    if (!importCourseName.trim()) { setImportError('Enter a name for this course.'); return }

    setImporting(true); setImportError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setImportError('Not logged in.'); setImporting(false); return }

    const name = importCourseName.trim()
    const col = teeToYardageCol(importTeeName)
    const apiHoles = Array.isArray(selectedTeeBox.holes) ? selectedTeeBox.holes : []
    const holesCount = selectedTeeBox.number_of_holes || 18

    const rows = Array.from({ length: holesCount }, (_, i) => {
      const h = apiHoles[i] || {}
      // Only set the yardage column matching this tee; undefined = don't overwrite others
      return {
        user_id: user.id,
        course_name: name,
        hole_number: i + 1,
        par: h.par ?? null,
        yardage_black: col === 'yardage_black' ? (h.yardage ?? null) : undefined,
        yardage_blue: col === 'yardage_blue' ? (h.yardage ?? null) : undefined,
        yardage_white: col === 'yardage_white' ? (h.yardage ?? null) : undefined,
        hazards: null,
        green_notes: null,
        personal_notes: null,
      }
    })

    const { error: holesError } = await supabase
      .from('course_holes').upsert(rows, { onConflict: 'user_id,course_name,hole_number' })

    if (holesError) {
      setImportError('Failed to save holes: ' + holesError.message)
      setImporting(false)
      return
    }

    // Save tee rating/slope to course_tees
    await supabase.from('course_tees').upsert({
      user_id: user.id,
      course_name: name,
      tee_name: importTeeName,
      gender: importGender,
      course_rating: selectedTeeBox.course_rating ?? null,
      slope_rating: selectedTeeBox.slope_rating ?? null,
      par_total: selectedTeeBox.par_total ?? null,
      holes_played: holesCount,
    }, { onConflict: 'user_id,course_name,tee_name,gender' })

    // Apply to manual entry section
    setCourseName(name)
    setImportCourse(null)
    setSearchQuery('')
    setImportSuccess(true)
    setTimeout(() => setImportSuccess(false), 4000)
    setImporting(false)
  }

  function cancelImport() {
    setImportCourse(null)
    setImportError(null)
    setSearchResults([])
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="page course-page">
      <div className="page-header">
        <h1 className="page-title">Course Setup</h1>
        <p className="page-subtitle">Import from GolfCourseAPI or build your yardage book manually</p>
      </div>

      {/* ── API Search ─────────────────────────────────────────── */}
      <div className="card">
        <h2 className="section-title">Search for a course</h2>
        <div className="search-row">
          <input
            className="form-input search-input"
            placeholder="e.g. Cedarbrook, Pebble Beach…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
          />
          <button
            className="btn btn-secondary search-btn"
            onClick={handleSearch}
            disabled={searchLoading || !searchQuery.trim()}
          >
            {searchLoading ? '…' : 'Search'}
          </button>
        </div>

        {importLoading && <p className="text-muted" style={{ marginTop: 10 }}>Loading course details…</p>}

        {searchError && <div className="cs-error">{searchError}</div>}

        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map(c => {
              const loc = [c.location?.city, c.location?.state].filter(Boolean).join(', ')
              return (
                <button
                  key={c.id}
                  className="search-result-item"
                  onClick={() => handleSelectResult(c)}
                >
                  <span className="result-name">{c.club_name}</span>
                  {c.course_name && c.course_name !== c.club_name && (
                    <span className="result-course">{c.course_name}</span>
                  )}
                  {loc && <span className="result-loc">{loc}</span>}
                </button>
              )
            })}
          </div>
        )}

        {importSuccess && (
          <div className="cs-success">
            Course imported — scroll down to edit individual holes or add hazard notes.
          </div>
        )}
      </div>

      {/* ── Import preview ─────────────────────────────────────── */}
      {importCourse && (
        <div className="card import-preview-card">
          <h2 className="section-title">Confirm import</h2>

          {importError && <div className="cs-error" style={{ marginBottom: 12 }}>{importError}</div>}

          <div className="form-group">
            <label className="form-label">Save as course name</label>
            <input
              className="form-input"
              value={importCourseName}
              onChange={e => setImportCourseName(e.target.value)}
            />
            <p className="form-hint">This is how the course appears in Caddie and Scorecard tabs.</p>
          </div>

          {/* Gender toggle */}
          <div className="form-group">
            <label className="form-label">Tees</label>
            <div className="cs-toggle-row">
              {['male', 'female'].map(g => (
                <button
                  key={g}
                  className={`cs-toggle-btn ${importGender === g ? 'active' : ''}`}
                  onClick={() => setImportGender(g)}
                >
                  {g === 'male' ? 'Men\'s' : 'Women\'s'}
                </button>
              ))}
            </div>
          </div>

          {availableTees.length === 0 ? (
            <div className="cs-error">
              No {importGender} tees found.
              {importCourse?.tees && typeof importCourse.tees === 'object' && Object.keys(importCourse.tees).length > 0
                ? ` Tees keys from API: "${Object.keys(importCourse.tees).join('", "')}". Check console (F12) for full response.`
                : ' The API returned no tees data for this course. Check console (F12) for the full response.'}
            </div>
          ) : (
            <>
              {/* Tee name dropdown */}
              <div className="form-group">
                <label className="form-label">Select tee</label>
                <select
                  className="form-select"
                  value={importTeeName}
                  onChange={e => setImportTeeName(e.target.value)}
                >
                  {availableTees.map(t => (
                    <option key={t.tee_name} value={t.tee_name}>{t.tee_name}</option>
                  ))}
                </select>
              </div>

              {/* Rating / slope strip */}
              {selectedTeeBox && (
                <div className="tee-stats-row">
                  <div className="tee-stat">
                    <span className="tee-stat-label">Rating</span>
                    <span className="tee-stat-val">{selectedTeeBox.course_rating ?? '—'}</span>
                  </div>
                  <div className="tee-stat">
                    <span className="tee-stat-label">Slope</span>
                    <span className="tee-stat-val">{selectedTeeBox.slope_rating ?? '—'}</span>
                  </div>
                  <div className="tee-stat">
                    <span className="tee-stat-label">Par</span>
                    <span className="tee-stat-val">{selectedTeeBox.par_total ?? '—'}</span>
                  </div>
                  <div className="tee-stat">
                    <span className="tee-stat-label">Yards</span>
                    <span className="tee-stat-val">{selectedTeeBox.total_yards ?? '—'}</span>
                  </div>
                </div>
              )}

              {/* Hole table */}
              {selectedTeeBox && (() => {
                const apiHoles = Array.isArray(selectedTeeBox.holes) ? selectedTeeBox.holes : []
                const count = selectedTeeBox.number_of_holes || 18
                const missingCount = Array.from({ length: count }, (_, i) => apiHoles[i] || {})
                  .filter(h => !h.par && !h.yardage).length

                return (
                  <>
                    {missingCount > 0 && (
                      <div className="cs-warn">
                        {missingCount} hole{missingCount > 1 ? 's' : ''} missing data from API — shown as "—". You can fill them in manually after importing.
                      </div>
                    )}
                    <div className="import-table-wrap">
                      <table className="import-hole-table">
                        <thead>
                          <tr>
                            <th>Hole</th>
                            <th>Par</th>
                            <th>Yards</th>
                            <th>S.I.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: count }, (_, i) => {
                            const h = apiHoles[i] || {}
                            return (
                              <tr key={i + 1}>
                                <td>{i + 1}</td>
                                <td>{h.par ?? '—'}</td>
                                <td>{h.yardage ?? '—'}</td>
                                <td className="si-col">{h.handicap ?? '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    <p className="form-hint" style={{ marginTop: 10 }}>
                      Yardage will be saved to the <strong>{teeToYardageCol(importTeeName).replace('yardage_', '').replace('_', ' ')}</strong> column.
                      Re-import a different tee to fill in other yardage columns.
                    </p>

                    <div className="import-btn-row">
                      <button
                        className="btn btn-primary"
                        onClick={handleImport}
                        disabled={importing || !importCourseName.trim()}
                      >
                        {importing ? 'Importing…' : `Import ${count} holes`}
                      </button>
                      <button className="btn btn-secondary" onClick={cancelImport}>
                        Cancel
                      </button>
                    </div>
                  </>
                )
              })()}
            </>
          )}

          {availableTees.length === 0 && (
            <button className="btn btn-secondary" onClick={cancelImport} style={{ marginTop: 12 }}>
              Cancel
            </button>
          )}
        </div>
      )}

      {/* ── Manual entry ───────────────────────────────────────── */}
      <div className="card">
        <h2 className="section-title">Manual entry</h2>

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

      {/* ── Existing holes list ─────────────────────────────────── */}
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
                  onClick={() => setSelectedHole(String(hole.hole_number))}
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
