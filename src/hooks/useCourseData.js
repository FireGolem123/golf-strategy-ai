import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useCourseData(courseName, holeNumber) {
  const [courseHole, setCourseHole] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!courseName || !holeNumber) {
      setCourseHole(null)
      return
    }

    let cancelled = false

    async function fetchHole() {
      setLoading(true)
      setError(null)

      const { data, error: err } = await supabase
        .from('course_holes')
        .select('*')
        .eq('course_name', courseName)
        .eq('hole_number', holeNumber)
        .maybeSingle()

      if (cancelled) return

      if (err) {
        setError(err.message)
      } else {
        setCourseHole(data)
      }
      setLoading(false)
    }

    fetchHole()
    return () => { cancelled = true }
  }, [courseName, holeNumber])

  return { courseHole, loading, error }
}
