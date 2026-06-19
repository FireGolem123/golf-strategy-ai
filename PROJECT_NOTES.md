# Golf Strategy AI — Project Notes

Last updated: June 19, 2026

## Status: MVP working ✅

Core loop is functional: voice input → transcript → Claude API (Haiku 4.5) → 
risk/reward club recommendation. Tested successfully on a fake course.

## What's built

- React + Vite frontend, mobile-first dark green UI
- Supabase backend (5 tables: player_profile, club_profiles, rounds, shot_history, course_holes)
- Anonymous auth (silent sign-in, no login screen)
- Web Speech API voice input
- Claude API integration using claude-haiku-4-5-20251001
- Pages: Caddie (home), Profile, Course Setup, History
- Deployed locally, pushed to GitHub (FireGolem123/golf-strategy-ai)

## System prompt location
`src/lib/claude.js` — includes player profile, club distances/miss tendencies, 
and course context injection. Has a "FUTURE FEATURES" section already stubbed in.

## Next session — what to add (priority order)

1. **Real course knowledge** — Cedarbrook hole-by-hole data isn't entered yet. 
   Either manually fill in Course Setup tab, or revisit the Golf Course API / 
   Golfbert API option we discussed for auto-populating yardages and hole info.

2. **Score tracker** — extend the `rounds` + `shot_history` flow so a full round 
   can be logged hole-by-hole (score per hole, fairways/greens hit, putts), not 
   just individual shot recommendations. History page should summarize this.

3. **GPS** — investigate browser Geolocation API to auto-detect which course/hole 
   you're on instead of manually selecting from a dropdown. Could also auto-calculate 
   distance-to-pin if we get green coordinates per hole.

4. **Weather data** — OpenWeatherMap API integration (mentioned early on, still 
   optional/free tier). Auto-pull wind speed/direction/temp based on course location 
   instead of you stating it manually in the voice input.

## Known things to keep an eye on

- API key currently lives in the browser bundle (`VITE_ANTHROPIC_API_KEY`) — fine 
  for solo personal use, but if this is ever shared/deployed publicly, move the 
  Claude call to a Vercel serverless function (`/api/recommend.js`) so the key 
  stays server-side.
- Anonymous Supabase auth means data is tied to the browser session — clearing 
  browser data would lose your saved profile/history. Fine for now, worth 
  revisiting if this becomes a "real" app.

## Cost tracking

Running on claude-haiku-4-5-20251001 — recommendations are costing fractions of 
a cent each. No real budget concern at personal-use volume.
