import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { extractScorecardFromImage } from '../lib/claude'
import '../styles/Scorecard.css'

const HOLES_18 = Array.from({ length: 18 }, (_, i) => i + 1)

function Stepper({ value, onChange, min = 0, max = 20 }) {
  const isNull = value === null || value === undefined
  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper-btn"
        onClick={() => { if (!isNull) onChange(Math.max(min, value - 1)) }}
        disabled={isNull || value <= min}
      >
        −
      </button>
      <span className="stepper-val">{isNull ? '—' : value}</span>
      <button
        type="button"
        className="stepper-btn"
        onClick={() => onChange(isNull ? min : Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  )
}

function Toggle({ value, options, onChange }) {
  return (
    <div className="toggle-group">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={`toggle-btn ${value === opt.value ? 'active' : ''}`}
          onClick={() => onChange(value === opt.value ? null : opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function SummaryBar({ holeScores, holesPlayed }) {
  const activeHoles = HOLES_18.slice(0, holesPlayed)
  const scoredHoles = activeHoles.filter(h => holeScores[h]?.score != null)

  const totalScore = scoredHoles.reduce((s, h) => s + (holeScores[h].score || 0), 0)
  const totalPar = scoredHoles.reduce((s, h) => s + (holeScores[h].par || 0), 0)
  const vsPar = totalPar > 0 ? totalScore - totalPar : null
  const totalPutts = scoredHoles.reduce((s, h) => s + (holeScores[h].putts || 0), 0)
  const hasPutts = scoredHoles.some(h => holeScores[h].putts != null)

  const fairwayHoles = scoredHoles.filter(h => (holeScores[h].par || 0) >= 4)
  const firCount = fairwayHoles.filter(h => holeScores[h].fairway_result === 'hit').length
  const firPct = fairwayHoles.length > 0 ? Math.round(firCount / fairwayHoles.length * 100) : null

  const girCount = scoredHoles.filter(h => holeScores[h].gir === true).length
  const girPct = scoredHoles.length > 0 ? Math.round(girCount / scoredHoles.length * 100) : null

  const vsParStr = vsPar === null ? '—' : vsPar === 0 ? 'E' : vsPar > 0 ? `+${vsPar}` : `${vsPar}`
  const vsParClass = vsPar === null ? '' : vsPar === 0 ? 'even' : vsPar > 0 ? 'over' : 'under'

  return (
    <div className="summary-bar">
      <div className="summary-stat">
        <span className="summary-num">{scoredHoles.length > 0 ? totalScore : '—'}</span>
        <span className="summary-label">Score</span>
      </div>
      <div className="summary-stat">
        <span className={`summary-num vs-par-${vsParClass}`}>{vsParStr}</span>
        <span className="summary-label">vs Par</span>
      </div>
      <div className="summary-stat">
        <span className="summary-num">{hasPutts ? totalPutts : '—'}</span>
        <span className="summary-label">Putts</span>
      </div>
      <div className="summary-stat">
        <span className="summary-num">{firPct !== null ? `${firPct}%` : '—'}</span>
        <span className="summary-label">FIR</span>
      </div>
      <div className="summary-stat">
        <span className="summary-num">{girPct !== null ? `${girPct}%` : '—'}</span>
        <span className="summary-label">GIR</span>
      </div>
      <div className="summary-stat">
        <span className="summary-num">{scoredHoles.length}/{holesPlayed}</span>
        <span className="summary-label">Holes</span>
      </div>
    </div>
  )
}

function HoleEntry({ holeNum, data, onFieldChange, saving }) {
  const par = data?.par ?? null

  return (
    <div className="hole-entry card">
      <div className="hole-entry-header">
        <span className="hole-entry-title">Hole {holeNum}</span>
        {saving && <span className="text-muted" style={{ fontSize: 12 }}>Saving…</span>}
      </div>

      <div className="entry-field">
        <span className="entry-label">Par</span>
        <Toggle
          value={par !== null ? String(par) : null}
          options={[{ label: '3', value: '3' }, { label: '4', value: '4' }, { label: '5', value: '5' }]}
          onChange={v => onFieldChange(holeNum, 'par', v !== null ? parseInt(v) : null)}
        />
      </div>

      <div className="entry-row">
        <div className="entry-field">
          <span className="entry-label">Score</span>
          <Stepper
            value={data?.score ?? null}
            min={1}
            max={15}
            onChange={v => onFieldChange(holeNum, 'score', v)}
          />
        </div>
        <div className="entry-field">
          <span className="entry-label">Putts</span>
          <Stepper
            value={data?.putts ?? null}
            min={0}
            max={10}
            onChange={v => onFieldChange(holeNum, 'putts', v)}
          />
        </div>
      </div>

      {(par === null || par >= 4) && (
        <div className="entry-field">
          <span className="entry-label">Fairway{par === null ? ' (par 4/5)' : ''}</span>
          <Toggle
            value={data?.fairway_result ?? null}
            options={[
              { label: 'Hit', value: 'hit' },
              { label: 'Left', value: 'left' },
              { label: 'Right', value: 'right' },
            ]}
            onChange={v => onFieldChange(holeNum, 'fairway_result', v)}
          />
        </div>
      )}

      <div className="entry-field">
        <span className="entry-label">Green in Regulation</span>
        <Toggle
          value={data?.gir === null || data?.gir === undefined ? null : (data.gir ? 'yes' : 'no')}
          options={[{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]}
          onChange={v => onFieldChange(holeNum, 'gir', v === null ? null : v === 'yes')}
        />
      </div>

      <div className="entry-row">
        <div className="entry-field">
          <span className="entry-label">Bunker</span>
          <Stepper value={data?.bunker_shots ?? 0} min={0} max={10} onChange={v => onFieldChange(holeNum, 'bunker_shots', v)} />
        </div>
        <div className="entry-field">
          <span className="entry-label">Chips</span>
          <Stepper value={data?.chip_shots ?? 0} min={0} max={10} onChange={v => onFieldChange(holeNum, 'chip_shots', v)} />
        </div>
        <div className="entry-field">
          <span className="entry-label">Penalty</span>
          <Stepper value={data?.penalties ?? 0} min={0} max={10} onChange={v => onFieldChange(holeNum, 'penalties', v)} />
        </div>
      </div>
    </div>
  )
}

export default function Scorecard() {
  const [phase, setPhase] = useState('setup')
  const [roundId, setRoundId] = useState(null)
  const [courseNames, setCourseNames] = useState([])
  const [roundForm, setRoundForm] = useState({
    course_name: '',
    date: new Date().toISOString().split('T')[0],
    tee_name: '',
    course_rating: '',
    slope_rating: '',
    holes_played: 18,
  })
  const [holeScores, setHoleScores] = useState({})
  const [expandedHole, setExpandedHole] = useState(null)
  const [savingHoles, setSavingHoles] = useState({})
  const [startingRound, setStartingRound] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importNeedsCourse, setImportNeedsCourse] = useState(false)

  const holeScoresRef = useRef({})
  const saveTimers = useRef({})
  const finalizingRef = useRef(false)
  const fileInputRef = useRef(null)
  const roundIdRef = useRef(null)

  useEffect(() => { roundIdRef.current = roundId }, [roundId])

  useEffect(() => {
    loadCourseNames()
  }, [])

  useEffect(() => {
    if (roundForm.course_name.trim()) {
      loadCoursePars(roundForm.course_name.trim())
    }
  }, [roundForm.course_name])

  // Check for round complete after every hole update
  useEffect(() => {
    if (phase !== 'scoring' || !roundId || finalizingRef.current) return
    const activeHoles = HOLES_18.slice(0, roundForm.holes_played)
    if (activeHoles.every(h => holeScores[h]?.score != null)) {
      const totalScore = activeHoles.reduce((s, h) => s + (holeScores[h].score || 0), 0)
      const totalPar = activeHoles.reduce((s, h) => s + (holeScores[h].par || 0), 0)
      finalizingRef.current = true
      finalizeRound(totalScore, totalPar || null)
    }
  }, [holeScores, phase, roundId, roundForm.holes_played])

  async function loadCourseNames() {
    const { data } = await supabase.from('course_holes').select('course_name')
    if (data) setCourseNames([...new Set(data.map(h => h.course_name))])
  }

  async function loadCoursePars(courseName) {
    const { data } = await supabase
      .from('course_holes')
      .select('hole_number, par')
      .eq('course_name', courseName)
    if (!data) return
    setHoleScores(prev => {
      const updated = { ...prev }
      data.forEach(({ hole_number, par }) => {
        updated[hole_number] = {
          bunker_shots: 0, chip_shots: 0, penalties: 0,
          ...updated[hole_number],
          par: updated[hole_number]?.par ?? par,
        }
      })
      holeScoresRef.current = updated
      return updated
    })
  }

  async function startRound(prefilledScores = null, form = null) {
    const f = form || roundForm
    if (!f.course_name.trim()) { alert('Enter a course name.'); return }

    setStartingRound(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStartingRound(false); return }

    const { data: existing } = await supabase
      .from('rounds')
      .select('id, tee_name, course_rating, slope_rating, holes_played')
      .eq('user_id', user.id)
      .eq('course_name', f.course_name.trim())
      .eq('date', f.date)
      .maybeSingle()

    let rId = existing?.id

    if (existing) {
      setRoundForm(prev => ({
        ...prev,
        course_name: f.course_name.trim(),
        tee_name: existing.tee_name || '',
        course_rating: existing.course_rating ?? '',
        slope_rating: existing.slope_rating ?? '',
        holes_played: existing.holes_played || 18,
      }))
      const { data: existingScores } = await supabase
        .from('hole_scores')
        .select('*')
        .eq('round_id', rId)
      const loaded = {}
      ;(existingScores || []).forEach(s => {
        loaded[s.hole_number] = {
          par: s.par, score: s.score, putts: s.putts,
          fairway_result: s.fairway_result, gir: s.gir,
          bunker_shots: s.bunker_shots ?? 0,
          chip_shots: s.chip_shots ?? 0,
          penalties: s.penalties ?? 0,
        }
      })
      setHoleScores(loaded)
      holeScoresRef.current = loaded
    } else {
      const slope = f.slope_rating !== '' ? parseInt(f.slope_rating) : 113
      const { data: newRound, error } = await supabase
        .from('rounds')
        .insert({
          user_id: user.id,
          course_name: f.course_name.trim(),
          date: f.date,
          tee_name: f.tee_name || null,
          course_rating: f.course_rating !== '' ? parseFloat(f.course_rating) : null,
          slope_rating: slope,
          holes_played: f.holes_played,
          source: prefilledScores ? 'photo_import' : 'manual',
        })
        .select('id')
        .single()

      if (error || !newRound) {
        alert('Failed to start round: ' + (error?.message || 'unknown error'))
        setStartingRound(false)
        return
      }
      rId = newRound.id

      if (prefilledScores) {
        const rows = Object.entries(prefilledScores)
          .filter(([, v]) => v.score != null || v.par != null)
          .map(([holeNum, v]) => ({
            user_id: user.id,
            round_id: rId,
            hole_number: parseInt(holeNum),
            par: v.par ?? null,
            score: v.score ?? null,
            putts: null, fairway_result: null, gir: null,
            bunker_shots: 0, chip_shots: 0, penalties: 0,
          }))
        if (rows.length > 0) {
          await supabase.from('hole_scores').upsert(rows, { onConflict: 'round_id,hole_number' })
        }
        setHoleScores(prev => {
          const merged = { ...prev }
          Object.entries(prefilledScores).forEach(([h, v]) => {
            const hn = parseInt(h)
            merged[hn] = {
              bunker_shots: 0, chip_shots: 0, penalties: 0,
              ...merged[hn],
              ...(v.par != null ? { par: v.par } : {}),
              ...(v.score != null ? { score: v.score } : {}),
            }
          })
          holeScoresRef.current = merged
          return merged
        })
      }
    }

    setRoundId(rId)
    roundIdRef.current = rId
    setPhase('scoring')
    setStartingRound(false)
  }

  function setHoleField(holeNum, field, value) {
    const current = holeScoresRef.current[holeNum] || {}
    const updated = { ...current, [field]: value }
    if (field === 'score' && value != null) updated.needsReview = false
    holeScoresRef.current = { ...holeScoresRef.current, [holeNum]: updated }
    setHoleScores({ ...holeScoresRef.current })

    const rId = roundIdRef.current
    if (!rId) return
    if (saveTimers.current[holeNum]) clearTimeout(saveTimers.current[holeNum])
    saveTimers.current[holeNum] = setTimeout(() => {
      saveHole(holeNum, holeScoresRef.current[holeNum], rId)
    }, 800)
  }

  async function saveHole(holeNum, data, rId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !rId) return
    setSavingHoles(prev => ({ ...prev, [holeNum]: true }))
    await supabase.from('hole_scores').upsert({
      user_id: user.id,
      round_id: rId,
      hole_number: holeNum,
      par: data.par ?? null,
      score: data.score ?? null,
      putts: data.putts ?? null,
      fairway_result: data.fairway_result ?? null,
      gir: data.gir ?? null,
      bunker_shots: data.bunker_shots ?? 0,
      chip_shots: data.chip_shots ?? 0,
      penalties: data.penalties ?? 0,
    }, { onConflict: 'round_id,hole_number' })
    setSavingHoles(prev => ({ ...prev, [holeNum]: false }))
  }

  async function finalizeRound(totalScore, totalPar) {
    const rId = roundIdRef.current
    if (!rId) return
    await supabase
      .from('rounds')
      .update({ score: totalScore, total_par: totalPar })
      .eq('id', rId)
    setPhase('complete')
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportLoading(true)
    setImportError(null)
    setImportPreview(null)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const result = await extractScorecardFromImage(base64, file.type, playerName)
      setImportPreview(result)
    } catch (err) {
      setImportError(err.message || 'Could not read scorecard. Try a clearer photo.')
    } finally {
      setImportLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleConfirmImport() {
    const preview = importPreview
    const formOverrides = {
      course_name: preview.course_name || roundForm.course_name,
      date: preview.date || roundForm.date,
      tee_name: preview.tee_name || roundForm.tee_name,
      ...(preview.holes_played ? { holes_played: preview.holes_played } : {}),
    }
    const mergedForm = { ...roundForm, ...formOverrides }

    if (!mergedForm.course_name.trim()) {
      setRoundForm(mergedForm)
      setImportNeedsCourse(true)
      return
    }

    setImportNeedsCourse(false)
    setRoundForm(mergedForm)

    const scores = {}
    ;(preview.holes || []).forEach(h => {
      scores[h.hole_number] = {
        par: h.par ?? null,
        score: h.score ?? null,
        putts: null, fairway_result: null, gir: null,
        bunker_shots: 0, chip_shots: 0, penalties: 0,
        needsReview: h.score == null || h.confidence === 'low',
      }
    })
    setHoleScores(prev => {
      const merged = { ...prev }
      Object.entries(scores).forEach(([h, v]) => {
        merged[parseInt(h)] = { ...(merged[parseInt(h)] || {}), ...v }
      })
      holeScoresRef.current = merged
      return merged
    })
    setImportPreview(null)
    startRound(scores, mergedForm)
  }

  function resetRound() {
    Object.values(saveTimers.current).forEach(clearTimeout)
    saveTimers.current = {}
    finalizingRef.current = false
    setPhase('setup')
    setRoundId(null)
    roundIdRef.current = null
    setHoleScores({})
    holeScoresRef.current = {}
    setExpandedHole(null)
    setRoundForm({
      course_name: '',
      date: new Date().toISOString().split('T')[0],
      tee_name: '', course_rating: '', slope_rating: '', holes_played: 18,
    })
  }

  // ── Setup phase ────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="page scorecard-page">
        <div className="page-header">
          <h1 className="page-title">Scorecard</h1>
          <p className="page-subtitle">Track your round hole by hole</p>
        </div>

        <div className="card">
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label">Your name on the scorecard</label>
            <input
              className="form-input"
              placeholder="e.g. Nate — helps find your row on shared cards"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
            />
          </div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handlePhotoSelect}
          />
          <button
            className="btn btn-secondary"
            style={{ width: '100%' }}
            onClick={() => fileInputRef.current?.click()}
            disabled={importLoading}
          >
            {importLoading ? 'Reading scorecard…' : '📷 Import from photo'}
          </button>
          {importError && <div className="import-error">{importError}</div>}
        </div>

        {importPreview && (
          <div className="card import-preview">
            <h3 className="sc-section-title">Confirm import</h3>
            {importPreview.course_name && (
              <p className="preview-row"><span className="preview-key">Course:</span> {importPreview.course_name}</p>
            )}
            {importPreview.date && (
              <p className="preview-row"><span className="preview-key">Date:</span> {importPreview.date}</p>
            )}
            {importPreview.tee_name && (
              <p className="preview-row"><span className="preview-key">Tees:</span> {importPreview.tee_name}</p>
            )}
            {importPreview.holes_played && (
              <p className="preview-row"><span className="preview-key">Holes:</span> {importPreview.holes_played}</p>
            )}
            {(importPreview.holes || []).length > 0 && (() => {
              const nullCount = importPreview.holes.filter(h => h.score == null).length
              const lowCount = importPreview.holes.filter(h => h.score != null && h.confidence === 'low').length
              return (
                <>
                  {(nullCount > 0 || lowCount > 0) && (
                    <div className="import-review-note">
                      {nullCount > 0 && `${nullCount} hole${nullCount > 1 ? 's' : ''} couldn't be read — marked ? below, you'll fill them in`}
                      {nullCount > 0 && lowCount > 0 && '. '}
                      {lowCount > 0 && `${lowCount} hole${lowCount > 1 ? 's' : ''} flagged ⚠ — double-check these`}
                    </div>
                  )}
                  <div className="preview-holes">
                    {importPreview.holes.map(h => {
                      const isNull = h.score == null
                      const isLow = !isNull && h.confidence === 'low'
                      return (
                        <div
                          key={h.hole_number}
                          className={`preview-hole-row ${isNull ? 'preview-needs-review' : isLow ? 'preview-low-confidence' : ''}`}
                        >
                          <span className="preview-hole-num">H{h.hole_number}</span>
                          <span className="preview-hole-par text-muted">Par {h.par ?? '?'}</span>
                          <span className="preview-hole-score">
                            {isNull ? '?' : h.score}{isLow ? ' ⚠' : ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )
            })()}
            {importNeedsCourse && (
              <div className="import-error" style={{ marginTop: 10 }}>
                Course name not found on the card — enter it in the Course Name field below, then tap "Use this scorecard" again.
              </div>
            )}
            <p className="text-muted" style={{ fontSize: 12, marginTop: 10, marginBottom: 14 }}>
              Fix any mistakes in the hole editor after confirming.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleConfirmImport}>
                Use this scorecard
              </button>
              <button className="btn btn-secondary" onClick={() => { setImportPreview(null); setImportNeedsCourse(false) }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="card">
          <h2 className="sc-section-title">Start a Round</h2>

          <div className="form-group">
            <label className="form-label">Course Name</label>
            <input
              className="form-input"
              list="sc-course-list"
              placeholder="e.g. Cedarbrook"
              value={roundForm.course_name}
              onChange={e => { setRoundForm(f => ({ ...f, course_name: e.target.value })); setImportNeedsCourse(false) }}
            />
            <datalist id="sc-course-list">
              {courseNames.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>

          <div className="sc-form-row">
            <div className="form-group sc-form-col">
              <label className="form-label">Date</label>
              <input
                className="form-input"
                type="date"
                value={roundForm.date}
                onChange={e => setRoundForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="form-group sc-form-col">
              <label className="form-label">Tee Name</label>
              <input
                className="form-input"
                placeholder="e.g. White"
                value={roundForm.tee_name}
                onChange={e => setRoundForm(f => ({ ...f, tee_name: e.target.value }))}
              />
            </div>
          </div>

          <div className="sc-form-row">
            <div className="form-group sc-form-col">
              <label className="form-label">Course Rating</label>
              <input
                className="form-input"
                type="number"
                step="0.1"
                placeholder="e.g. 71.4"
                value={roundForm.course_rating}
                onChange={e => setRoundForm(f => ({ ...f, course_rating: e.target.value }))}
              />
            </div>
            <div className="form-group sc-form-col">
              <label className="form-label">Slope Rating</label>
              <input
                className="form-input"
                type="number"
                placeholder="113 = neutral"
                value={roundForm.slope_rating}
                onChange={e => setRoundForm(f => ({ ...f, slope_rating: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: 12, marginTop: -8, marginBottom: 14 }}>
            Find rating &amp; slope on your scorecard or at usga.org. Slope defaults to 113 (neutral) if blank.
          </p>

          <div className="form-group">
            <label className="form-label">Holes Played</label>
            <Toggle
              value={String(roundForm.holes_played)}
              options={[{ label: '9 holes', value: '9' }, { label: '18 holes', value: '18' }]}
              onChange={v => { if (v) setRoundForm(f => ({ ...f, holes_played: parseInt(v) })) }}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={() => startRound()}
            disabled={startingRound || !roundForm.course_name.trim()}
          >
            {startingRound ? 'Starting…' : '⛳ Start Round'}
          </button>
        </div>
      </div>
    )
  }

  // ── Complete phase ─────────────────────────────────────────────
  if (phase === 'complete') {
    const activeHoles = HOLES_18.slice(0, roundForm.holes_played)
    const totalScore = activeHoles.reduce((s, h) => s + (holeScores[h]?.score || 0), 0)
    const totalPar = activeHoles.reduce((s, h) => s + (holeScores[h]?.par || 0), 0)
    const vsPar = totalPar > 0 ? totalScore - totalPar : null
    const vsParStr = vsPar === null ? '' : vsPar === 0 ? 'Even par' : vsPar > 0 ? `+${vsPar}` : `${vsPar}`
    const vsParClass = vsPar === null ? '' : vsPar === 0 ? 'even' : vsPar > 0 ? 'over' : 'under'

    return (
      <div className="page scorecard-page">
        <div className="page-header">
          <h1 className="page-title">Round Complete</h1>
          <p className="page-subtitle">{roundForm.course_name} · {roundForm.date}</p>
        </div>
        <div className="card complete-card">
          <div className="complete-score">{totalScore}</div>
          {vsPar !== null && (
            <div className={`complete-vs-par vs-par-${vsParClass}`}>{vsParStr}</div>
          )}
          <div style={{ marginTop: 16 }}>
            <SummaryBar holeScores={holeScores} holesPlayed={roundForm.holes_played} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={resetRound}>
          Start another round
        </button>
      </div>
    )
  }

  // ── Scoring phase ──────────────────────────────────────────────
  const activeHoles = HOLES_18.slice(0, roundForm.holes_played)

  return (
    <div className="page scorecard-page">
      <div className="page-header" style={{ marginBottom: 10 }}>
        <h1 className="page-title">Scorecard</h1>
        <p className="page-subtitle">{roundForm.course_name} · {roundForm.date}</p>
      </div>

      <SummaryBar holeScores={holeScores} holesPlayed={roundForm.holes_played} />

      <div className="card">
        <div className="hole-grid">
          {activeHoles.map(h => {
            const scored = holeScores[h]?.score != null
            const par = holeScores[h]?.par
            const score = holeScores[h]?.score
            const diff = par != null && score != null ? score - par : null
            const diffClass = diff === null ? '' : diff < 0 ? 'birdie' : diff === 0 ? 'even' : diff === 1 ? 'bogey' : 'double'
            const needsReview = holeScores[h]?.needsReview && !scored
            return (
              <button
                key={h}
                className={`hole-btn ${scored ? 'scored' : ''} ${expandedHole === h ? 'active' : ''} ${needsReview ? 'needs-review' : ''}`}
                onClick={() => setExpandedHole(expandedHole === h ? null : h)}
              >
                <span className="hole-btn-num">{h}</span>
                {scored && (
                  <span className={`hole-btn-score ${diffClass}`}>{score}</span>
                )}
                {needsReview && <span className="hole-btn-review">?</span>}
              </button>
            )
          })}
        </div>
        <p className="text-muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 4 }}>
          Tap a hole to enter score
        </p>
      </div>

      {expandedHole !== null && (
        <HoleEntry
          key={expandedHole}
          holeNum={expandedHole}
          data={holeScores[expandedHole] || {}}
          onFieldChange={setHoleField}
          saving={!!savingHoles[expandedHole]}
        />
      )}
    </div>
  )
}
