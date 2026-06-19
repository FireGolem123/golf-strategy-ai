# Production & Scaling Notes

Things that work fine for solo personal use but would need to change before this app is shared
publicly or used at scale. Grouped by category.

---

## Security

### API keys exposed in browser bundle
**Current:** `VITE_ANTHROPIC_API_KEY`, `VITE_OPENWEATHER_API_KEY`, and `VITE_GOLFCOURSEAPI_KEY`
are all bundled into the client-side JavaScript. Anyone who opens DevTools can read them.

**Fix:** Move every third-party API call to a serverless function:
- Vercel: `api/recommend.js`, `api/weather.js`, `api/courses.js`
- Netlify: `netlify/functions/`
- Or a lightweight Express/Hono backend

The frontend calls your own `/api/...` endpoint; the server holds the keys and calls the real APIs.
This is a one-session refactor.

### No user authentication
**Current:** Anonymous Supabase auth — each browser session gets a random UUID. Data is siloed
per browser with no way to log in from a second device.

**Fix:** Replace `supabase.auth.signInAnonymously()` with email/password or OAuth (Google, Apple).
Supabase Auth handles this natively. Row-level security policies already use `auth.uid()` so the
data model doesn't need to change — only the sign-in flow.

### No input sanitisation beyond DB types
**Current:** Free-text fields (course name, hazards, notes) are passed directly to Supabase.
Supabase parameterises queries so SQL injection is not a risk, but malicious text could appear
in the Claude prompt.

**Fix:** Trim and length-cap user inputs before they reach the prompt builder. Add a server-side
max-length check on free-text columns.

---

## API rate limits and costs

### Anthropic (Claude Haiku)
- **Limit:** Rate-limited by tokens per minute and requests per minute on the free/build tier.
  At personal volume this is irrelevant. At scale (hundreds of users), you'd hit TPM limits fast.
- **Cost:** Haiku is cheap (~$0.00025/1K input tokens) but costs add up with many users.
- **Fix:** Add a server-side request queue or per-user daily cap. Consider caching repeated
  recommendations for identical situations.

### OpenWeatherMap
- **Limit:** Free tier = 1,000 calls/day, max 60/minute. One call per user page load.
  Fine personally; breaks at ~1,000 daily active users.
- **Cost:** Paid tiers start at ~$40/month for higher volume.
- **Fix:** Cache the weather response server-side by lat/lng rounded to ~1 mile, with a
  10-minute TTL. 100 users at the same course = 1 API call, not 100.

### GolfCourseAPI
- **Limit:** Free tier = 50 requests/day total (not per user — shared across the account).
  Search + detail = 2 requests per course lookup. At 25 course imports/day the free tier is gone.
- **Cost:** Paid tiers required for production volume.
- **Fix:** Cache course data in Supabase after first import. If a course already exists in
  `course_holes` for any user, skip the API call and clone/suggest it. This also reduces
  duplicate data entry across users.

---

## Data model limitations

### Anonymous auth = no cross-device access
Data is tied to a browser session UUID. Logging in from a phone and a desktop gives two
completely separate accounts.
**Fix:** Real auth (see Security above).

### No data backup / export
If a user clears browser storage, their anonymous session is gone and Supabase data is
orphaned (no way to recover it without the original UUID).
**Fix:** Export to CSV/JSON button in Profile. Or just use real auth so there's always a
recoverable identity.

### course_holes has no stroke index column
The GolfCourseAPI returns `handicap` (stroke index) per hole and we display it in the import
preview, but we don't persist it to `course_holes`. If you ever want the caddie to factor in
stroke index for net scoring, you'd need to add a `stroke_index integer` column.
**Fix:** `ALTER TABLE course_holes ADD COLUMN stroke_index integer;` and populate during import.

### Rounds have no concept of "in progress" vs "complete"
A round without a `score` is implicitly in-progress, but nothing prevents a completed round
(with a score) from being re-opened and edited into an inconsistent state.
**Fix:** Add a `status text` column (`'in_progress'` | `'complete'`) and gate editing logic on it.

### hole_scores.user_id is redundant
`hole_scores` has its own `user_id` column but is already protected by the `round_id` FK which
itself has RLS on `rounds`. The double check is fine but adds a join requirement for every insert.
Not a bug, just slightly denormalised.

---

## Performance

### No pagination on History
`loadHistory()` fetches all rounds and all shot history for the user in two unbounded queries.
Fine for a personal app with dozens of rounds; slow for a user with hundreds.
**Fix:** Paginate rounds (`.range(0, 19)`) and lazy-load shot history per round on expand.

### No loading states on initial data fetch
Profile, Course Setup, and Home all block render until Supabase returns. On a slow connection
this produces blank screens.
**Fix:** Add skeleton loaders or a top-level loading spinner during the initial `useEffect` fetch.

### Weather fetched on every Home mount
Each time the user navigates to the Caddie tab, `fetchWeather()` fires and counts against the
OWM limit.
**Fix:** Cache the result in `sessionStorage` with a timestamp; skip the API call if cached
data is < 10 minutes old.

---

## Mobile / PWA

### Not installable as a PWA
The app works in a mobile browser but has no manifest or service worker, so it can't be added
to the home screen as a proper app icon.
**Fix:** Add `vite-plugin-pwa`. Minimal config: app name, icon set, `display: standalone`.
Offline support for the caddie tab would need a service worker caching strategy for the JS bundle.

### Voice input not supported on iOS Safari
Web Speech API (`SpeechRecognition`) is not available on iOS Safari. The mic button is hidden
when `isSupported` is false, but there's no fallback.
**Fix:** Either accept text-only on iOS, or integrate a third-party STT service (Whisper API,
Deepgram) that works cross-browser via `MediaRecorder` → audio blob → transcription endpoint.

### No offline mode
The app requires network for every feature. On a golf course with patchy signal this is painful.
**Fix:** Service worker to cache the app shell. Pre-cache course hole data for selected courses
so the Caddie tab works offline. Queue feedback saves and sync when back online.

---

## Feature gaps for multi-user / social

- No sharing of course data between users (each imports their own copy)
- No leaderboard / handicap comparison
- No push notifications for round reminders
- No image storage for scorecards (currently processed in memory, not stored)

These are all scope additions rather than bugs, but worth noting if the app ever grows.
