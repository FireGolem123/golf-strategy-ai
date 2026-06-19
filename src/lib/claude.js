// NOTE: In production, Claude API calls must go through a backend/edge function.
// Calling the Anthropic API directly from the browser exposes your API key.
// For Vercel deployment, move this logic to /api/recommend.js (Vercel serverless function).

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

const WIND_DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
function windDir(deg) {
  return WIND_DIRS[Math.round(deg / 22.5) % 16]
}

function buildShotHistorySection(shotHistory) {
  if (!shotHistory || shotHistory.length === 0) return ''

  const byClub = {}
  for (const shot of shotHistory) {
    const club = shot.club_used || shot.club_suggested
    if (!club) continue
    if (!byClub[club]) byClub[club] = { count: 0, ratings: [], outcomes: [] }
    byClub[club].count++
    if (shot.suggestion_rating) byClub[club].ratings.push(shot.suggestion_rating)
    if (shot.outcome) byClub[club].outcomes.push(shot.outcome)
  }

  if (Object.keys(byClub).length === 0) return ''

  const lines = Object.entries(byClub)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([club, d]) => {
      const avg = d.ratings.length
        ? (d.ratings.reduce((s, r) => s + r, 0) / d.ratings.length).toFixed(1) + '★'
        : 'unrated'
      const recent = d.outcomes.slice(-3).join('; ')
      return `${club}: ${d.count} shots, ${avg}${recent ? ` — "${recent}"` : ''}`
    })

  return `

SHOT HISTORY (recent data — spot miss patterns and calibrate confidence per club):
${lines.join('\n')}`
}

function buildSystemPrompt(playerProfile, clubProfiles, shotHistory) {
  const clubList = clubProfiles && clubProfiles.length > 0
    ? clubProfiles.map(c => `${c.club_name}: ${c.carry_distance} yards | miss: ${c.miss_tendency || 'unknown'}`).join('\n')
    : 'No club distances entered yet. Ask player to set up their profile.'

  return `You are an expert golf caddie and strategist. Your job is to give the player a fast, confident club selection recommendation with a clear risk/reward breakdown.

PLAYER PROFILE:
Ball flight: ${playerProfile?.ball_flight || 'unknown'}
General tendency: ${playerProfile?.general_tendency || 'none noted'}
Handicap: ${playerProfile?.handicap ?? 'unknown'}

CLUB DISTANCES (carry yards):
${clubList}${buildShotHistorySection(shotHistory)}

RESPONSE FORMAT:
Always respond in this exact structure:

🏌️ SITUATION SUMMARY
[One sentence synthesizing what the player told you]

✅ RECOMMENDED PLAY
Club: [Club name]
Why: [2-3 sentences max]

⚠️ RISK/REWARD BREAKDOWN
Safe play: [Club + where to aim + why]
Aggressive play: [Club + where to aim + what you're going for]
Avoid: [What not to do and why, based on miss tendencies and hazards]

🌦️ CONDITIONS NOTED
[Briefly confirm what conditions you factored in, including wind and temperature if provided]

RULES:
- Be decisive. Give a clear recommendation, not 'it depends'
- Factor in miss tendencies when hazards are mentioned
- If shot history shows a club is unreliable (low rating or repeated bad outcomes), factor that into your recommendation — suggest stepping up or down a club if appropriate
- If wind is provided, adjust carry distances accordingly (headwind: reduce distance, tailwind: add distance)
- If they say they are hitting it farther or shorter today, adjust distances accordingly
- Keep total response under 150 words
- Never ask clarifying questions. Work with what you are given.`
}

function buildUserMessage(situationText, courseHole, weather) {
  const courseContext = courseHole
    ? `COURSE CONTEXT:
Hole ${courseHole.hole_number} | Par ${courseHole.par}
Yardages: Black ${courseHole.yardage_black} | Blue ${courseHole.yardage_blue} | White ${courseHole.yardage_white}
Hazards: ${courseHole.hazards || 'none noted'}
Green notes: ${courseHole.green_notes || 'none'}
Personal notes: ${courseHole.personal_notes || 'none'}`
    : 'No course data loaded.'

  const weatherContext = weather
    ? `

CURRENT CONDITIONS:
Temperature: ${weather.temp}°F (feels like ${weather.feels_like}°F)
Wind: ${weather.wind_speed} mph from the ${windDir(weather.wind_deg)}${weather.wind_gust ? `, gusting ${weather.wind_gust} mph` : ''}
Sky: ${weather.condition}`
    : ''

  return `${courseContext}${weatherContext}

PLAYER'S SITUATION:
${situationText}`
}

export async function extractScorecardFromImage(base64Image, mediaType, playerName = '') {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'your_anthropic_api_key') {
    throw new Error('Anthropic API key not configured.')
  }

  const playerInstruction = playerName.trim()
    ? `PLAYER TO FIND: Look for a handwritten name that matches or closely resembles "${playerName.trim()}". Extract scores only from that player's row. If you cannot confidently identify which row belongs to this player, set score: null for those holes rather than guessing.`
    : `PLAYER TO FIND: Extract scores from the first or most prominent player row on the card.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Image },
          },
          {
            type: 'text',
            text: `You are reading a physical golf scorecard from a photograph.

GOLF SCORECARD STRUCTURE — understand this before extracting anything:

1. PAR ROW: A printed row labeled "Par" showing each hole's par (3, 4, or 5). This is the same for every player and every round. Do NOT extract this as anyone's score.

2. STROKE INDEX / HANDICAP ROW: A row of small numbers (1–18 in a shuffled order) near the hole numbers. This is a difficulty ranking, not a score. Ignore it completely.

3. PLAYER SCORE ROWS: One handwritten row per player, each next to or below a handwritten player name. These contain actual scores for that round.
   - CIRCLED NUMBERS: A circled number (e.g. a "4" with a circle around it) is still that hole's score — golfers circle birdies or notable holes as a decoration. Extract the number inside the circle as the score.
   - OUT / IN / TOTAL columns: Running totals at the end of each nine holes. Use these as a sanity check: a player's hole-by-hole scores should sum to approximately the OUT or IN total shown next to their name. If your extracted scores don't sum close to that total, lower your confidence.

${playerInstruction}

HOLES ON THIS CARD: Some cards show only 9 holes (front nine = holes 1–9, back nine = holes 10–18). Look at the actual hole numbers printed on the card. Only return holes that are present — do not assume 18 holes exist. Set holes_played to 9 or 18 based on what you see.

Return ONLY valid JSON — no markdown fences, no explanation, nothing else:
{
  "course_name": "string or null",
  "date": "YYYY-MM-DD or null",
  "tee_name": "string or null",
  "holes_played": 9,
  "holes": [
    { "hole_number": 1, "par": 4, "score": 5, "confidence": "high" },
    { "hole_number": 2, "par": 3, "score": null, "confidence": "low" }
  ]
}

CONFIDENCE VALUES:
- "high": the number is clearly legible and unambiguous
- "low": smudged, cramped, could be two different digits, circled in a confusing way, or the running-total sanity check doesn't support this reading

MOST IMPORTANT RULE: When in doubt, set score to null and confidence to "low". A null score is flagged for the user to fill in manually — that is safe. A wrong score silently corrupts statistics — that is not safe. Never guess.

If there is no scorecard visible in this image: {"error": "No scorecard detected"}`,
          },
        ],
      }],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `API error ${response.status}`)
  }

  const data = await response.json()
  let text = data.content[0].text.trim()
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Could not parse response as JSON. Try a clearer photo.')
  }

  if (parsed.error) throw new Error(parsed.error)
  return parsed
}

export async function getClubRecommendation(situationText, playerProfile, clubProfiles, courseHole, shotHistory, weather) {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'your_anthropic_api_key') {
    throw new Error('Anthropic API key not configured. Add VITE_ANTHROPIC_API_KEY to your .env file.')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: buildSystemPrompt(playerProfile, clubProfiles, shotHistory),
      messages: [
        {
          role: 'user',
          content: buildUserMessage(situationText, courseHole, weather),
        },
      ],
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error?.error?.message || `API error ${response.status}`)
  }

  const data = await response.json()
  return data.content[0].text
}
