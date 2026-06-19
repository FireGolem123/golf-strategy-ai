const BASE_URL = 'https://api.golfcourseapi.com'
const API_KEY = import.meta.env.VITE_GOLFCOURSEAPI_KEY

function authHeaders() {
  return { 'Authorization': `Key ${API_KEY}` }
}

async function apiFetch(path) {
  if (!API_KEY) {
    throw new Error('GolfCourse API key not configured. Add VITE_GOLFCOURSEAPI_KEY to your .env file.')
  }

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() })
  } catch {
    throw new Error('Network error — check your connection and try again.')
  }

  if (res.status === 401) {
    throw new Error('Invalid API key. Check VITE_GOLFCOURSEAPI_KEY in your .env file.')
  }
  if (!res.ok) {
    // Free tier is 50 req/day — a 429 or unexpected error should surface clearly
    throw new Error(`GolfCourse API error (${res.status}). If you've made many searches today, you may have hit the 50 req/day free-tier limit.`)
  }

  return res.json()
}

export async function searchCourses(query) {
  if (!query || !query.trim()) return []
  const data = await apiFetch(`/v1/search?search_query=${encodeURIComponent(query.trim())}`)
  return Array.isArray(data?.courses) ? data.courses : []
}

export async function getCourseById(id) {
  if (!id) throw new Error('Course ID is required.')
  const data = await apiFetch(`/v1/courses/${id}`)
  return data || null
}
