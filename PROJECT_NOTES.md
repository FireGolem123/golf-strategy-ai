# Golf Strategy AI — Project Notes

Last updated: June 19, 2026

## Status: Score tracking live ✅

Core caddie loop working since session 1. Score tracking (manual + photo import) and handicap
calculator added in session 2.

## What's built

- React + Vite frontend, mobile-first dark green UI
- Supabase backend (6 tables — see below)
- Anonymous auth (silent sign-in, no login screen)
- Web Speech API voice input
- Claude API integration using claude-haiku-4-5-20251001
- Pages: Caddie (home), Profile, Course, Score, History
- Deployed locally, pushed to GitHub (FireGolem123/golf-strategy-ai)

## Database tables

| Table | Purpose |
|---|---|
| player_profile | Ball flight, handicap, home course, tendencies |
| club_profiles | Per-club carry distances and miss tendencies |
| rounds | One row per round. Extended with tee_name, course_rating, slope_rating, total_par, holes_played, source |
| shot_history | Individual caddie recommendations and feedback (from Caddie tab) |
| course_holes | Per-hole yardages, hazards, green notes (from Course tab) |
| hole_scores | Per-hole scores, putts, FIR, GIR, bunker/chip/penalty counts — links to rounds |

Schema files:
- `SUPABASE_SETUP.sql` — run first (base tables)
- `SUPABASE_SCORE_TRACKING.sql` — run second (extends rounds table, adds hole_scores)

## Key file locations

- `src/lib/claude.js` — two exported functions:
  - `getClubRecommendation()` — caddie system prompt + structured response
  - `extractScorecardFromImage(base64, mediaType, playerName)` — vision call, returns JSON with course/holes. playerName tells Claude which row to read on multi-player cards.
- `src/pages/Scorecard.jsx` + `src/styles/Scorecard.css` — score tracking page
- `src/pages/Profile.jsx` — includes handicap calculator section (below club distances)
- `src/hooks/useCourseData.js` — single-hole par/hazard lookup for the Caddie tab

## System prompt location

`src/lib/claude.js` — includes player profile, club distances/miss tendencies, and course context
injection. Has a "FUTURE FEATURES" section already stubbed in.

## Scorecard feature notes

- Autosaves each hole 800ms after last field change (upsert on `round_id, hole_number`)
- Resume logic: if a round exists for the same course+date, it loads existing scores instead of
  creating a duplicate (matches Home.jsx's activeRoundId pattern)
- Round complete auto-detected when all holes in holes_played have a score; writes total_score +
  total_par back to `rounds`
- Photo import: base64-encodes image client-side, sends to Claude vision, shows extracted
  course/date/holes in a confirm step before writing anything to DB
- Slope defaults to 113 (neutral) if left blank on round setup form

## Handicap calculator notes

- USGA formula: differential = (score - course_rating) × 113 / slope_rating, rounded to 1 decimal
- Best 8 of last 20 qualifying rounds (must have course_rating + slope_rating set)
- Minimum 5 qualifying rounds to show an index
- "Use this handicap" button rounds to integer before writing (player_profile.handicap is integer)
- Rounds missing rating/slope are counted and surfaced so the user knows which ones to fill in

## Next session — what to add (priority order)

1. **Scorecard UX restructure** — split Scorecard into two distinct flows:
   - "Track live round" — current hole-by-hole scoring behavior (no change)
   - "Log completed round" — enter a past round: photo import OR manual total score OR full
     hole-by-hole. Saves immediately as complete.
   - Post-round editing: from the mode-picker screen, show recent rounds so you can tap one
     and add/edit hole-by-hole detail after the fact.

2. **Real Cedarbrook hole-by-hole data** — either manually fill in Course Setup tab, or revisit
   the Golf Course API / Golfbert API option for auto-populating yardages and hole info.

3. **GPS** — browser Geolocation API to auto-detect which course/hole you're on instead of
   manually selecting. Could also auto-calculate distance-to-pin if green coordinates are stored
   per hole.

4. **Weather data** — OpenWeatherMap API integration (optional/free tier). Auto-pull wind
   speed/direction/temp based on course location.

## Known things to keep an eye on

- API key currently lives in the browser bundle (`VITE_ANTHROPIC_API_KEY`) — fine for solo
  personal use, but if ever shared/deployed publicly, move Claude calls to a Vercel serverless
  function (`/api/recommend.js`) so the key stays server-side.
- Anonymous Supabase auth means data is tied to the browser session — clearing browser data loses
  saved profile/history. Worth revisiting if this becomes a "real" app.

## Cost tracking

Running on claude-haiku-4-5-20251001 — caddie recommendations and scorecard OCR are each fractions
of a cent. No real budget concern at personal-use volume.
