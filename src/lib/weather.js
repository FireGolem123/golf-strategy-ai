const OWM_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY

const WIND_DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
export function windDir(deg) {
  return WIND_DIRS[Math.round(deg / 22.5) % 16]
}

export async function getCurrentWeather() {
  if (!OWM_KEY) throw new Error('OpenWeatherMap API key not configured.')

  const coords = await new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location not supported in this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(new Error(
        err.code === 1 ? 'Location permission denied — tap "Get weather" to try again.'
          : 'Could not get location. Check GPS signal.'
      )),
      { timeout: 10000, maximumAge: 300000 }
    )
  })

  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&appid=${OWM_KEY}&units=imperial`
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message || `Weather API error ${res.status}`)
  }
  const data = await res.json()

  return {
    temp: Math.round(data.main.temp),
    feels_like: Math.round(data.main.feels_like),
    wind_speed: Math.round(data.wind.speed),
    wind_deg: data.wind.deg,
    wind_gust: data.wind.gust ? Math.round(data.wind.gust) : null,
    condition: data.weather[0]?.description || '',
    humidity: data.main.humidity,
    location: data.name,
    coords,
  }
}
