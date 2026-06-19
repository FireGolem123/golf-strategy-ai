// NOTE: In production, Claude API calls must go through a backend/edge function.
// Calling the Anthropic API directly from the browser exposes your API key.
// For Vercel deployment, move this logic to /api/recommend.js (Vercel serverless function).

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

function buildSystemPrompt(playerProfile, clubProfiles) {
  const clubList = clubProfiles && clubProfiles.length > 0
    ? clubProfiles.map(c => `${c.club_name}: ${c.carry_distance} yards | miss: ${c.miss_tendency || 'unknown'}`).join('\n')
    : 'No club distances entered yet. Ask player to set up their profile.'

  return `You are an expert golf caddie and strategist. Your job is to give the player a fast, confident club selection recommendation with a clear risk/reward breakdown.

PLAYER PROFILE:
Ball flight: ${playerProfile?.ball_flight || 'unknown'}
General tendency: ${playerProfile?.general_tendency || 'none noted'}
Handicap: ${playerProfile?.handicap ?? 'unknown'}

CLUB DISTANCES (carry yards):
${clubList}

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
[Briefly confirm what conditions you factored in]

RULES:
- Be decisive. Give a clear recommendation, not 'it depends'
- Factor in miss tendencies when hazards are mentioned
- If they say they are hitting it farther or shorter today, adjust distances accordingly
- Keep total response under 150 words
- Never ask clarifying questions. Work with what you are given.

FUTURE FEATURES (not yet active, ignore for now):
- Weather API integration pulling real wind and temperature automatically
- Shot history learning from recent round data
- Golf course API for automatic hole layout data
- Post-round feedback and outcome tracking`
}

function buildUserMessage(situationText, courseHole) {
  const courseContext = courseHole
    ? `
COURSE CONTEXT:
Hole ${courseHole.hole_number} | Par ${courseHole.par}
Yardages: Black ${courseHole.yardage_black} | Blue ${courseHole.yardage_blue} | White ${courseHole.yardage_white}
Hazards: ${courseHole.hazards || 'none noted'}
Green notes: ${courseHole.green_notes || 'none'}
Personal notes: ${courseHole.personal_notes || 'none'}
`
    : 'No course data loaded.'

  return `${courseContext}

PLAYER'S SITUATION:
${situationText}`
}

export async function getClubRecommendation(situationText, playerProfile, clubProfiles, courseHole) {
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
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: buildSystemPrompt(playerProfile, clubProfiles),
      messages: [
        {
          role: 'user',
          content: buildUserMessage(situationText, courseHole),
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
