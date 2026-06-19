# Golf Strategy AI

An AI-powered golf caddie and round tracker. Get instant club recommendations tailored to your distances and miss tendencies, track scores hole-by-hole, import completed scorecards from a photo, and calculate your USGA handicap index.

## Features

- **AI Caddie** — speak your shot situation, get a club recommendation with risk/reward breakdown
- **Scorecard tracker** — track rounds hole-by-hole with score, putts, FIR, GIR, bunkers, chips, penalties
- **Photo import** — photograph a completed scorecard and Claude extracts course, par, and scores automatically (handles multi-player cards, circled birdies, 9-hole rounds)
- **Handicap calculator** — USGA-style index from your last 20 qualifying rounds, with "use this" button to apply it to your profile
- **Course yardage book** — per-hole hazard notes, green notes, and personal playing tips
- **Shot history** — caddie rating feedback tracked per round

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/FireGolem123/golf-strategy-ai
cd golf-strategy-ai
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In **SQL Editor → New query**, run `SUPABASE_SETUP.sql` first
3. Then run `SUPABASE_SCORE_TRACKING.sql` in a second query (adds score tracking tables)
4. In Supabase: go to **Settings → API** and copy your Project URL and `anon` public key

### 3. Get your Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key

### 4. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

> **Security note:** `VITE_ANTHROPIC_API_KEY` is exposed in the browser bundle.
> This is fine for personal solo use. For a public deployment, move Claude API calls
> to a Vercel serverless function (`/api/recommend.js`) so the key stays server-side.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Database schema

Two SQL files in the repo root:

| File | When to run |
|---|---|
| `SUPABASE_SETUP.sql` | Fresh setup — creates all base tables |
| `SUPABASE_SCORE_TRACKING.sql` | After base setup — adds score tracking columns and `hole_scores` table |

## Deploy to Vercel

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → import your repo
3. Add the three environment variables in Vercel project settings
4. Deploy

Vercel automatically runs `npm run build` and serves the `dist` folder.

## Project structure

```
src/
  hooks/
    useVoiceInput.js      # Web Speech API wrapper
    useCourseData.js      # Single-hole par/hazard lookup
  lib/
    supabase.js           # Supabase client
    claude.js             # getClubRecommendation + extractScorecardFromImage
  pages/
    Home.jsx              # Caddie tab — voice input → recommendation → feedback
    Profile.jsx           # Player profile, club distances, handicap calculator
    CourseSetup.jsx       # Per-hole yardage book
    Scorecard.jsx         # Round tracker + photo import
    History.jsx           # Past rounds and shot history
  styles/
    index.css             # CSS variables (dark green theme)
    App.css               # Shared layout, cards, buttons, forms
    Home.css / Profile.css / CourseSetup.css / Scorecard.css / History.css
```

## Tech stack

- React 18 + Vite
- Supabase (Postgres + anonymous auth)
- Anthropic Claude API (claude-haiku-4-5-20251001)
- Web Speech API
- React Router v6
- Vercel hosting
