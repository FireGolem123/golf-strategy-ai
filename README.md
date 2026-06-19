# Golf Strategy AI

An AI-powered golf caddie app. Speak your shot situation and get an instant club recommendation with risk/reward breakdown — tailored to your distances, miss tendencies, and the course you're playing.

## Features

- Voice input via Web Speech API
- Claude AI for caddie recommendations
- Supabase for player profile, club distances, course data, shot history
- Mobile-first dark green UI

## Setup

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd golf-strategy-ai
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Run the SQL in the section below to create all tables
3. In Supabase: go to **Settings → API** and copy your Project URL and `anon` public key

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
> For production, move Claude API calls to a Vercel serverless function (`/api/recommend.js`)
> and call it from the frontend instead of calling Anthropic directly.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Supabase SQL

Run this in the Supabase SQL editor (**SQL Editor → New query**):

```sql
-- See SUPABASE_SETUP.sql in this repo for the full schema
```

The complete SQL is in `SUPABASE_SETUP.sql`.

## Deploy to Vercel

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → import your repo
3. Add the three environment variables in Vercel project settings
4. Deploy

Vercel automatically runs `npm run build` and serves the `dist` folder.

## Project Structure

```
src/
  components/     # Shared UI components
  hooks/          # useVoiceInput, useCourseData
  lib/            # supabase.js, claude.js
  pages/          # Home, Profile, CourseSetup, History
  styles/         # CSS per page + global
```

## Tech Stack

- React 18 + Vite
- Supabase (Postgres + Auth)
- Anthropic Claude API
- Web Speech API
- React Router v6
- Vercel hosting
