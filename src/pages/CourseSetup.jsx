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

function getTeesForGender(tees, gender) {
  if (!tees || typeof tees !== 'object') return []
  if (Array.isArray(tees[gender])) return tees[gender]
  const cap = gender.charAt(0).toUpperCase() + gender.slice(1)
  if (Array.isArray(tees[cap])) return tees[cap]
  for (const [k, v] of Object.entries(tees)) {
    if (k.toLowerCase() === gender && Array.isArray(v)) return v
  }
  return []
}

function teeToYardageCol(teeName) {
  const n = (teeName || '').toLowerCase()
  if (n.includes('black') || n.includes('champion') || n.includes('tournament') || n.includes('gold')) return 'yardage_black'
  if (n.includes('white') || n.includes('middle') || n.includes('men')) return 'yardage_white'
  return 'yardage_blue'
}

export default function CourseSetup() {
  // ── Core editor state ──────────────────────────────────────────
  const [allCourseNames, setAllCourseNames] = useState([])   // courses the user has saved
  const [courseName, setCourseName] = useState('')
  const [selectedHole, setSelectedHole] = useState('1')
  const [holeData, setHoleData] = useState(EMPTY_HOLE)
  const [existingHoles, setExistingHoles] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  // ── Search panel state (collapsible) ──────────────────────────
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)

  // ── Import state ───────────────────────────────────────────────
  const [importCourse, setImportCourse] = useState(null)
  const [importCourseName, setImportCourseName] = useState('')
  const [importGender, setImportGender] = useState('male')
  const [importTeeName, setImportTeeName] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importSuccess, setImportSuccess] = useState(false)

  const availableTees = getTeesForGender(importCourse?.tees, importGender)
  const selectedTeeBox = availableTees.find(t => t.tee_name === importTeeName) || null

  // ── Load saved course names on mount ──────────────────────────
  useEffect(() => {
    loadAllCourseNames()
  }, [])

  // ── Load holes when course name changes ───────────────────────
  useEffect(() => {
    if (courseName.trim()) {
      loadExistingHoles(courseName)
    } else {
      setExistingHoles([])
    }
  }, [courseName])

  useEffect(() => {
    if (courseName.trim() && selectedHole) {
      loadHole(courseName, parseInt(selectedHole))
    }
  }, [courseName, selectedHole])

  useEffect(() => {
    const tees = importCourse?.tees?.[importGender] || []
    setImportTeeName(tees[0]?.tee_name || '')
  }, [importGender, importCourse])

  // ── Data functions ─────────────────────────────────────────────
  async function loadAllCourseNames() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('course_holes').select('course_name').eq('user_id', user.id)
    if (data) setAllCourseNames([...new Set(data.map(h => h.course_name))].sort())
  }

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
      loadAllCourseNames()
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

  // ── Search functions ───────────────────────────────────────────
  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearchLoading(true); setSearchError(null); setSearchResults([])
    try {
      const results = await searchCourses(searchQuery)
      if (results.length === 0) setSearchError('No courses found — try a different name.')
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
      const hasTees = course.tees && typeof course.tees === 'object' &&
        Object.values(course.tees).some(v => Array.isArray(v) && v.length > 0)
      let full = hasTees ? course : await getCourseById(course.id)
      if (!full) throw new Error('Course details not found.')
      const derivedName = (full.course_name && full.course_name !== full.club_name)
        ? `${full.club_name} — ${full.course_name}`
        : (full.club_name || full.course_name || '')
      setImportCourse(full)
      setImportCourseName(courseName.trim() || derivedName)
      setImportGender('male')
    } catch (err) {
      setImportError(err.message)
    } finally {
      setImportLoading(false)
    }
  }

  // ── Import — preserves existing hazard/green/personal notes ───
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

    // Fetch existing holes so we can preserve notes
    const { data: existingData } = await supabase
      .from('course_holes').select('hole_number, hazards, green_notes, personal_notes')
      .eq('user_id', user.id).eq('course_name', name)
    const existingMap = {}
    ;(existingData || []).forEach(h => { existingMap[h.hole_number] = h })

    const rows = Array.from({ length: holesCount }, (_, i) => {
      const h = apiHoles[i] || {}
      const existing = existingMap[i + 1] || {}
      return {
        user_id: user.id,
        course_name: name,
        hole_number: i + 1,
        par: h.par ?? null,
        yardage_black: col === 'yardage_black' ? (h.yardage ?? null) : undefined,
        yardage_blue: col === 'yardage_blue' ? (h.yardage ?? null) : undefined,
        yardage_white: col === 'yardage_white' ? (h.yardage ?? null) : undefined,
        // Preserve any notes the user has already written
        hazards: existing.hazards ?? null,
        green_notes: existing.green_notes ?? null,
        personal_notes: existing.personal_notes ?? null,
      }
    })

    const { error: holesError } = await supabase
      .from('course_holes').upsert(rows, { onConflict: 'user_id,course_name,hole_number' })

    if (holesError) {
      setImportError('Failed to save holes: ' + holesError.message)
      setImporting(false)
      return
    }

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

    setCourseName(name)
    setImportCourse(null)
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
    setImportSuccess(true)
    setTimeout(() => setImportSuccess(false), 4000)
    setImporting(false)
    loadAllCourseNames()
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
        <h1 className="page-title">My Courses</h1>
        <p className="page-subtitle">Build your yardage book — the caddie uses it every shot</p>
      </div>

      {/* ── Saved courses quick-pick ──────────────────────────── */}
      {allCourseNames.length > 0 && (
        <div className="saved-courses-row">
          <p className="saved-courses-label">Your courses</p>
          <div className="course-chips">
            {allCourseNames.map(name => (
              <button
                key={name}
                className={`course-chip ${courseName === name ? 'active' : ''}`}
                onClick={() => { setCourseName(name); setSelectedHole('1') }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Course name + search trigger ──────────────────────── */}
      <div className="card">
        <div className="course-name-row">
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">Course name</label>
            <input
              className="form-input"
              placeholder="e.g. Cedarbrook"
              value={courseName}
              onChange={e => { setCourseName(e.target.value); setShowSearch(false); setImportCourse(null) }}
            />
          </div>
          <button
            className={`btn btn-secondary search-trigger-btn ${showSearch ? 'active' : ''}`}
            onClick={() => { setShowSearch(v => !v); setImportCourse(null) }}
            title="Search online for yardages"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Import
          </button>
        </div>

        {/* Search panel */}
        {showSearch && (
          <div className="search-panel">
            <p className="search-panel-hint">
              Search for your course to import hole yardages and par. Your hazard notes and personal notes are always preserved.
            </p>
            <div className="search-row">
              <input
                className="form-input search-input"
                placeholder="Search by course or club name…"
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
          </div>
        )}

        {importSuccess && (
          <div className="cs-success" style={{ marginTop: 12 }}>
            Yardages imported — your notes were kept. Now add hazards and personal notes hole by hole below.
          </div>
        )}
      </div>

      {/* ── Import preview ─────────────────────────────────────── */}
      {importCourse && (
        <div className="card import-preview-card">
          <h2 className="section-title">Confirm import</h2>
          <p className="search-panel-hint" style={{ marginBottom: 14 }}>
            This updates yardages and par only — any hazard notes or personal notes you've already saved won't be touched.
          </p>

          {importError && <div className="cs-error" style={{ marginBottom: 12 }}>{importError}</div>}

          <div className="form-group">
            <label className="form-label">Save as course name</label>
            <input
              className="form-input"
              value={importCourseName}
              onChange={e => setImportCourseName(e.target.value)}
            />
            <p className="form-hint">Must match the name in Caddie and Scorecard tabs exactly.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Tees</label>
            <div className="cs-toggle-row">
              {['male', 'female'].map(g => (
                <button
                  key={g}
                  className={`cs-toggle-btn ${importGender === g ? 'active' : ''}`}
                  onClick={() => setImportGender(g)}
                >
                  {g === 'male' ? "Men's" : "Women's"}
                </button>
              ))}
            </div>
          </div>

          {availableTees.length === 0 ? (
            <div className="cs-error">
              No {importGender} tees found in the API data for this course.
            </div>
          ) : (
            <>
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

              {selectedTeeBox && (() => {
                const apiHoles = Array.isArray(selectedTeeBox.holes) ? selectedTeeBox.holes : []
                const count = selectedTeeBox.number_of_holes || 18
                const missingCount = Array.from({ length: count }, (_, i) => apiHoles[i] || {})
                  .filter(h => !h.par && !h.yardage).length
                return (
                  <>
                    {missingCount > 0 && (
                      <div className="cs-warn">
                        {missingCount} hole{missingCount > 1 ? 's' : ''} missing data — shown as "—". Fill in manually after importing.
                      </div>
                    )}
                    <div className="import-table-wrap">
                      <table className="import-hole-table">
                        <thead>
                          <tr><th>Hole</th><th>Par</th><th>Yards</th><th>S.I.</th></tr>
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
                      Re-import a different tee to fill other columns.
                    </p>
                    <div className="import-btn-row">
                      <button
                        className="btn btn-primary"
                        onClick={handleImport}
                        disabled={importing || !importCourseName.trim()}
                      >
                        {importing ? 'Importing…' : `Import ${count} holes`}
                      </button>
                      <button className="btn btn-secondary" onClick={cancelImport}>Cancel</button>
                    </div>
                  </>
                )
              })()}
            </>
          )}

          {availableTees.length === 0 && (
            <button className="btn btn-secondary" onClick={cancelImport} style={{ marginTop: 12 }}>Cancel</button>
          )}
        </div>
      )}

      {/* ── Hole editor — only shown once a course is named ──────── */}
      {courseName.trim() && (
        <>
          <div className="card">
            <div className="hole-editor-header">
              <h2 className="section-title" style={{ marginBottom: 0 }}>
                {courseName} — Hole editor
              </h2>
              <span className="hole-editor-hint">
                {existingHoles.length > 0 ? `${existingHoles.length} hole${existingHoles.length !== 1 ? 's' : ''} saved` : 'No holes yet'}
              </span>
            </div>
            <p className="search-panel-hint" style={{ marginBottom: 14, marginTop: 6 }}>
              Green = hole has data. Select a hole then fill in yardages, hazards, and your personal notes.
            </p>

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

          {loading ? (
            <p className="text-muted" style={{ textAlign: 'center' }}>Loading…</p>
          ) : (
            <div className="card">
              <h2 className="section-title">Hole {selectedHole}</h2>

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
                <label className="form-label">Green notes</label>
                <textarea
                  className="form-textarea"
                  placeholder="e.g. slopes back to front, fast, two-tier, pin usually back right on weekends"
                  value={holeData.green_notes}
                  onChange={e => setHoleData(d => ({ ...d, green_notes: e.target.value }))}
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label className="form-label">My notes <span className="form-label-sub">(just for you — the caddie reads these)</span></label>
                <textarea
                  className="form-textarea"
                  placeholder="e.g. always miss right here — aim at left edge of green. Take one more club. Don't be short."
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

          {/* Compact saved holes overview */}
          {existingHoles.length > 0 && (
            <div className="card">
              <h2 className="section-title">Saved holes</h2>
              {existingHoles.map(hole => (
                <div key={hole.id} className="hole-list-item">
                  <div className="hole-list-info">
                    <span className="hole-list-num">Hole {hole.hole_number}</span>
                    <span className="hole-list-par text-muted">Par {hole.par}</span>
                    {hole.yardage_white && <span className="text-muted">{hole.yardage_white} yds</span>}
                    {hole.personal_notes && <span className="hole-has-notes">📝</span>}
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
        </>
      )}
    </div>
  )
}
