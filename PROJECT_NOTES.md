# Golf Strategy AI — Project Notes

Last updated: June 24, 2026

## Status: All core features live ✅

Session 1: core caddie loop (voice → Claude → recommendation).
Session 2: score tracking, photo import, handicap calculator.
Session 3: weather, shot history feedback loop, GolfCourseAPI import, History edit/delete, caddie UX polish.
Session 4: real auth (email + Google OAuth), visual consistency pass (SVG nav icons, Scorecard form alignment, toggle equal-width).
Session 5: major QoL pass — scorecard persistence, hole nav, mid-round notes, round plan mode, course setup redesign, shot merging.

## What's built

- React + Vite frontend, mobile-first dark green UI
- Supabase backend (7 tables — see below)
- Real auth: email/password + Google OAuth (Supabase Auth). Anonymous auth removed.
- Auth page (`src/pages/Auth.jsx`): Sign In / Sign Up tabs, Google OAuth button, forgot password, email confirmation state.
- Web Speech API voice input
- Claude Haiku 4.5 for caddie recommendations, scorecard photo OCR, and round strategy
- OpenWeatherMap weather bar (auto-fetches via browser GPS on Caddie tab load)
- GolfCourseAPI course search and import (Course tab)
- Pages: Caddie (/), Profile (/profile), Course (/course-setup), Score (/scorecard), History (/history)
- Pushed to GitHub: FireGolem123/golf-strategy-ai
- Deployed to Vercel: https://golf-caddie-ai.vercel.app (auto-deploys on push to main)

### Session 5 additions
- **Scorecard tab persistence** — active round state saved to `localStorage`. Switching to Caddie tab and back no longer loses your round.
- **Hole navigation** — prev/next (‹/›) buttons on the hole entry card so you can move between holes without going back to the grid.
- **Flexible holes-played** — setup screen now accepts any number 1–18 (not just 9/18). Quick buttons for 9 and 18, plus a custom number input.
- **Finish early** — "Save & Finish Round" button on the scoring screen saves whatever holes are entered without requiring all to be complete.
- **Mid-round adjustments** — collapsible "Round Adjustments" section on the Caddie tab appears when a round is active today. Free-text notes (e.g. "hitting irons right and short") are saved to `rounds.notes` and injected into every Claude recommendation that round as high-priority context overriding profile defaults.
- **Round Plan mode** — mode toggle (Hole / Round Plan) on the Caddie tab. Round Plan mode fetches all holes for the selected course and calls Claude for a full pre-round game plan: 3 focus themes + hole-by-hole tactical notes with explicit tee club suggestions. Driver is assumed default on par 4/5 unless a specific hazard overrides.
- **Course Setup redesign** — "My Courses" page with saved-course chips for quick selection. Search/import is now a collapsible panel inline with the course editor (not a separate card). Import no longer overwrites hazard notes or personal notes — only updates yardage columns and par.
- **Round merge in History** — "Move shots →" button on any round card that has shots. Moves all shots to a selected round (fixes the case where caddie was used outside a round and auto-created a separate round from the scorecard round).
- **Unlinked shot assignment** — shots with no `round_id` appear as a collapsible "🔗 X unlinked shots" card in History with per-shot round assignment dropdowns.

## Database tables

| Table | Purpose |
|---|---|
| player_profile | Ball flight, handicap, home course, tendencies |
| club_profiles | Per-club carry distances and miss tendencies |
| rounds | One row per round — course_name, date, score, tee_name, course_rating, slope_rating, total_par, holes_played, source |
| shot_history | Per-recommendation feedback — club suggested/used, rating, outcome, conditions text |
| course_holes | Per-hole yardages (black/blue/white), hazards, green notes, personal notes |
| hole_scores | Per-hole scores, putts, FIR, GIR, bunker/chip/penalty — links to rounds |
| course_tees | Rating/slope per course+tee — populated by GolfCourseAPI import, read by Scorecard to auto-fill |

Schema files (run in order in Supabase SQL editor):
1. `SUPABASE_SETUP.sql` — base tables
2. `SUPABASE_SCORE_TRACKING.sql` — extends rounds, adds hole_scores
3. `SUPABASE_COURSE_TEES.sql` — adds course_tees

## Key file locations

### API clients
- `src/lib/supabase.js` — Supabase client init
- `src/lib/claude.js` — `getClubRecommendation(situation, profile, clubs, courseHole, shotHistory, weather)` and `extractScorecardFromImage(base64, mediaType, playerName)`
- `src/lib/weather.js` — `getCurrentWeather()` (browser geolocation → OpenWeatherMap), exports `windDir(deg)`
- `src/lib/golfCourseApi.js` — `searchCourses(query)` and `getCourseById(id)`. Auth header is `Key <token>` (not Bearer). Free tier = 50 req/day. getCourseById unwraps `{ course: {...} }` response wrapper.

### Pages
- `src/pages/Home.jsx` — Caddie tab: mode toggle (Hole/Round Plan), voice input, weather bar, course/hole selectors, mid-round adjustments section, recommendation, feedback. Loads shot history (last 30) and passes to Claude. Round Plan mode loads all course holes and calls `getRoundStrategy()`.
- `src/pages/Profile.jsx` — Player profile, club distances, USGA handicap calculator
- `src/pages/CourseSetup.jsx` — Redesigned: saved-course chips at top, inline search/import panel, manual hole editor. Import preserves existing notes.
- `src/pages/Scorecard.jsx` — Round tracker: persists to `localStorage` (key: `golf_active_round`), hole grid with prev/next nav, flexible holes-played (1–18), "Save & Finish Round" early exit, photo import via Claude vision, auto-saves, round auto-complete detection.
- `src/pages/History.jsx` — Round list with inline edit and delete. Shot list per round. "Move shots →" merge panel. "🔗 Unlinked shots" card for shots with no round_id.

### Hooks
- `src/hooks/useCourseData.js` — loads single course hole row (par, yardages, hazards, notes) for Caddie tab
- `src/hooks/useVoiceInput.js` — Web Speech API wrapper

## Caddie system prompt

`src/lib/claude.js → buildSystemPrompt()` injects:
- Player profile (ball flight, tendency, handicap)
- Club distances and miss tendencies (all clubs)
- Shot history patterns (last 30 shots grouped by club: count, avg rating, recent outcomes)

`buildUserMessage(situationText, courseHole, weather, roundNotes)` injects per-request:
- Course hole data (par, yardages, hazards, green notes, personal notes) — only when course+hole selected
- Current weather (temp, wind speed/direction/gusts, conditions) — only when weather loaded
- Mid-round adjustments (from `rounds.notes`) — labeled as high-priority context overriding profile defaults

`getRoundStrategy(courseName, allHoles, playerProfile, clubProfiles, shotHistory, weather, roundNotes)`:
- Formats all course holes as a compact layout string
- Uses same system prompt as hole caddie
- Adds explicit rule: driver is default on par 4/5 unless specific hazard overrides
- Returns: 3 focus themes + hole-by-hole tactical notes with named tee club per hole
- Max 350 words, claude-haiku-4-5

## Scorecard feature notes

- Autosaves each hole 800ms after last field change (debounced upsert on `round_id, hole_number`)
- Resume logic: same course+date → loads existing round instead of creating duplicate
- Round complete: auto-detected when all holes_played have a score, writes total to rounds
- Photo import: base64 client-side → Claude vision → confirm preview → DB write
- Slope defaults to 113 (neutral) if blank
- Course name typed in setup → queries course_tees → auto-fills tee_name, course_rating, slope_rating if fields are empty

## Course import flow

1. Course tab → search by name → tap result
2. Pick Men's/Women's tees, select tee name from dropdown
3. Preview shows rating, slope, par, total yards, hole-by-hole table (par/yardage/stroke index)
4. "Import N holes" → writes to course_holes (yardage goes to column matching tee color: black/blue/white) + course_tees (rating/slope)
5. Re-import a different tee to fill in additional yardage columns

## Handicap calculator notes

- USGA formula: differential = (score − course_rating) × 113 / slope_rating, rounded to 1 decimal
- Best 8 of last 20 qualifying rounds (must have course_rating + slope_rating)
- Minimum 5 qualifying rounds to display
- "Use this handicap" rounds to integer (player_profile.handicap is integer column)

### Session 6 additions
- **Logo** — `src/components/Logo.jsx`: `LogoMark` (pin + circuit SVG) and `LogoHorizontal` (mark + CADDIE AI wordmark + tagline). Standalone SVG at `assets/logo/caddie-ai-mark.svg`.
- **Background texture (2C)** — radial green glow from top + crosshatch grid on `html, body`
- **Card highlight** — 1px top border at 6% white opacity on all `.card` elements for lifted feel
- **Mic button** — replaced emoji with proper SVG microphone, double ring glow, "TAP TO SPEAK" label
- **Active Caddie nav icon** — uses filled logo pin mark SVG instead of generic flag
- **Recommendation pills** — colored pill tags (SITUATION / PLAY / RISK / CONDITIONS) replace emoji section headers
- **Mode toggle icons** — inline SVG pin and map icons replace text-only buttons
- **Layout overflow fix** — `overflow: hidden` on `.app-layout` prevents long text from widening the page
- **Hole info badge fixed height** — 82px fixed height prevents layout shift when hole is selected/deselected
- **UI Style Guide** — `UI_STYLE_GUIDE.md` documents full color scale, typography, component specs, logo usage

## Next priorities / ideas

1. **Course maps / green maps** — no clean free API exists for this. Options to explore:
   - Golfbert API has some course layout data
   - SVG green diagrams drawn manually per hole (stored in DB)
   - Photo upload per hole (user takes a photo of the green on the course, stored in Supabase Storage)

2. **GPS auto-detect** — browser Geolocation to auto-select course and hole on Caddie tab mid-round

3. **Stats / trends page** — scoring average, GIR%, FIR%, putts per round charted over time

4. **Scorecard "log completed round" mode** — quick entry for after the fact: photo import or just enter total score, no hole-by-hole required

## Auth implementation details

### How anonymous → real account migration works

**Sign-up path (best case, no migration needed):**
- If the user still has an active anonymous session when they sign up, `Auth.jsx` calls:
  - Email/password signup: `supabase.auth.updateUser({ email, password })` — promotes the anonymous user in-place. user_id stays the same, all existing data is preserved automatically.
  - Google signup: uses `signInWithOAuth` (new user_id), then migration RPC reassigns data afterward.

**Sign-in path (cross-device, requires DB migration):**
- If the user signs in to an existing real account on a browser that had anonymous data, App.jsx stores the anonymous user_id (`golf_anon_uid` in localStorage) on load.
- After `SIGNED_IN` fires with a different user_id, `App.jsx` calls the `migrate_anonymous_data` RPC to reassign rows.
- If the RPC fails (not created yet), a subtle notice is shown; sign-in still succeeds.
- Requires creating `migrate_anonymous_data(anon_user_id uuid)` in Supabase — see SQL below.

### Migration RPC SQL (run once in Supabase SQL editor)

```sql
CREATE OR REPLACE FUNCTION migrate_anonymous_data(anon_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = anon_user_id AND is_anonymous = true
  ) THEN RETURN; END IF;

  UPDATE player_profile SET user_id = auth.uid() WHERE user_id = anon_user_id;
  UPDATE club_profiles   SET user_id = auth.uid() WHERE user_id = anon_user_id;
  UPDATE rounds          SET user_id = auth.uid() WHERE user_id = anon_user_id;
  UPDATE hole_scores     SET user_id = auth.uid() WHERE user_id = anon_user_id;
  UPDATE course_holes    SET user_id = auth.uid() WHERE user_id = anon_user_id;
  UPDATE shot_history    SET user_id = auth.uid() WHERE user_id = anon_user_id;
END;
$$;
```

### RLS policy status
All existing RLS policies use `auth.uid() = user_id`. These work identically for real and anonymous sessions — no changes needed. Real accounts just have `is_anonymous = false`.

### Supabase dashboard Google OAuth config
See checklist below under "Supabase dashboard config needed".

## Supabase dashboard config needed (Google OAuth)

### Step 1 — Create Google Cloud OAuth credentials
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create Project (if needed)
3. Click **Create Credentials** → **OAuth client ID**
4. Application type: **Web application**
5. Add Authorized redirect URIs:
   - `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Find your project ref in Supabase Dashboard → Settings → General
6. Save — copy the **Client ID** and **Client Secret**

### Step 2 — Enable Google in Supabase Auth
1. Supabase Dashboard → Authentication → Providers → Google
2. Toggle **Enable Google provider**
3. Paste Client ID and Client Secret
4. Save

### Step 3 — Add redirect URL allowlist
1. Supabase Dashboard → Authentication → URL Configuration
2. Add to **Redirect URLs**:
   - `http://localhost:5173` (dev)
   - `https://golf-caddie-ai.vercel.app` (production — already added)
3. Set **Site URL** to `http://localhost:5173` for local dev (change to production URL when done with local testing)

### Step 4 — Email confirmation settings
- Default: email confirmation is ON (users get a confirmation email on sign-up). Leave this on.
- If you want to skip confirmation for testing: Authentication → Settings → uncheck "Enable email confirmations" (not recommended for production)

## Known things to keep an eye on

- API keys live in the browser bundle — fine for solo personal use. If ever shared publicly, move Claude/OWM/GolfCourseAPI calls to Vercel serverless functions so keys stay server-side.
- GolfCourseAPI free tier is 50 requests/day — search + detail = 2 requests per course import.
- The `migrate_anonymous_data` RPC must be created in Supabase for cross-device data migration to work. Until then, migration silently fails (non-blocking) and a notice is shown to the user.

## Cost tracking

- Claude Haiku 4.5: caddie recommendations and scorecard OCR are fractions of a cent each
- OpenWeatherMap: free tier, no cost concern at personal volume
- GolfCourseAPI: free tier, 50 req/day — no cost, just a rate limit
