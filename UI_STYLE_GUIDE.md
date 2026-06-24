# Caddie AI — UI Style Guide

Last updated: June 24, 2026

## Design Philosophy

Dark green sports-tech aesthetic — feels like a premium golf app with an AI edge. Mobile-first (480px max-width), dark outdoor-optimized palette, no light mode. Inspired by modern sports analytics apps with a caddie/course feel.

---

## Color Scale

```css
--green-900: #080f0b   /* page background */
--green-800: #111f17   /* nav bar, input backgrounds */
--green-750: #162a1e   /* card backgrounds */
--green-700: #1c3828   /* card borders, subtle elements */
--green-600: #245c3c   /* input borders, dividers */
--green-500: #2e7a50   /* mid-accent (rarely used directly) */
--green-400: #3da066   /* primary button, active borders */
--green-300: #5ec98a   /* highlights, active states, labels */
--white:     #f0f4f1   /* primary text */
--gray-200:  #c8d0ca   /* secondary text */
--gray-400:  #7a8c7e   /* muted text, inactive nav */
--gray-500:  #4a5c4e   /* placeholder text */
--gray-600:  #2e3d32   /* very subtle elements */
--gold:      #c9a84c   /* risk/reward pills, warnings */
--red:       #c0392b   /* errors, danger actions */
```

---

## Background Texture (2C)

Applied to `html, body` — crosshatch grid with radial glow from top:

```css
background-color: var(--green-900);
background-image:
  radial-gradient(ellipse at 50% 0%, rgba(22,56,34,0.5) 0%, transparent 55%),
  repeating-linear-gradient(0deg, transparent, transparent 18px, rgba(255,255,255,0.02) 18px, rgba(255,255,255,0.02) 19px),
  repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(255,255,255,0.02) 18px, rgba(255,255,255,0.02) 19px);
```

---

## Typography

- Font: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Base: 16px / 1.5 line-height, antialiased
- Page titles: 22px, weight 700, `--white`
- Section labels (COURSE, HOLE, SITUATION): 13px, weight 600, uppercase, letter-spacing 0.05em, `--gray-200`
- Nav labels: 10px, weight 600, letter-spacing 0.04em
- Pill tags: 9px, weight 700, uppercase, letter-spacing 0.12em

---

## Cards

```css
background: var(--green-750);
border: 1px solid var(--green-700);
border-top-color: rgba(255, 255, 255, 0.06);  /* subtle highlight — lifts card off background */
border-radius: 14px;
padding: 16px;
```

The 1px white top border at 6% opacity gives cards a "lifted" appearance against the dark background.

---

## Buttons

**Primary (CTA):**
```css
background: var(--green-400);
color: #fff;
border-radius: 10px;
padding: 12px 20px;
font-size: 15px;
font-weight: 700;
letter-spacing: 0.03em;
width: 100%;
```
Hover: `--green-300` background, `--green-900` text.

**Secondary:**
```css
background: var(--green-700);
border: 1px solid var(--green-600);
color: var(--white);
```

**Mode toggle (Hole Caddie / Round Plan):**
```css
/* inactive */
background: var(--green-800);
border: 1px solid var(--green-700);
color: var(--gray-400);

/* active */
background: var(--green-700);
border-color: var(--green-400);
color: var(--white);
```
Buttons are `flex: 1` in a row, equal width, with SVG icons + label gap 7px.

---

## Form Inputs / Selects / Textareas

```css
background: var(--green-800);
border: 1px solid var(--green-600);
border-radius: 10px;
padding: 10px 12px;
color: var(--white);
font-size: 15px;
```
Focus: `border-color: var(--green-300)`.

---

## Bottom Navigation

```css
height: 64px;
background: var(--green-800);
border-top: 1px solid var(--green-700);
position: fixed; bottom: 0;
max-width: 480px;
```

**Active indicator:** 2px green bar at top of active item via `::before` pseudo-element (28px wide, `--green-300`).

**Active Caddie tab icon:** uses the LogoMark pin SVG (filled) instead of a generic outline icon.

Icons: 22×22px Feather-style SVGs (`stroke="currentColor"`, strokeWidth 2, rounded caps/joins).

Nav labels: 10px, weight 600.

---

## Mic Button

```css
width: 96px;
height: 96px;
border-radius: 50%;
background: var(--green-750);
border: 1.5px solid rgba(61, 160, 102, 0.55);
box-shadow: 0 0 0 6px rgba(61, 160, 102, 0.07),
            0 0 0 12px rgba(61, 160, 102, 0.04);
color: var(--green-300);
```

- Icon: inline SVG microphone (26×26px) — not an emoji
- Label: "TAP TO SPEAK" — 10px, weight 700, uppercase, letter-spacing 0.08em
- Listening state: pulsing double ring animation (`pulse-ring` keyframes), border `--green-300`
- Stop state: square stop icon SVG

---

## Recommendation Pills

Pill tags replace emoji section headers. Each pill + section title is on a flex row:

| Pill class | Color | Used for |
|---|---|---|
| `.pill-situation` | Green (`--green-300`) | SITUATION summary |
| `.pill-play` | Dark green (`#3da066`) | RECOMMENDED PLAY |
| `.pill-risk` | Gold (`--gold`) | RISK / REWARD |
| `.pill-conditions` | Gray | CONDITIONS |

```css
.rec-pill {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  padding: 3px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}
```

---

## Logo

**Component:** `src/components/Logo.jsx`  
**Standalone SVG:** `assets/logo/caddie-ai-mark.svg`

### LogoMark — pin with circuit branches
- 40×40px viewBox SVG
- Pin shaft: white stroke, `strokeLinecap: round`
- Flag polygon: `#639922` fill
- Base ellipse: `#3B6D11` stroke
- Base circle: `#97C459` fill
- Branch arms + nodes: `#97C459` lines, `#C0DD97` circles

### LogoHorizontal layout
- LogoMark (36px) + text column
- "CADDIE" — 18px, weight 700, letter-spacing 0.12em, `--white`
- "AI" pill — `#639922` background, 9px, weight 700, letter-spacing 0.2em
- "YOUR SMART CADDIE" tagline — 9px, uppercase, letter-spacing 0.18em, `#444441`

---

## SVG Icons (inline, `currentColor`)

All icons use `currentColor` so they adapt to active/inactive nav states.

- **Caddie nav (active):** filled pin mark (matches logo)
- **Caddie nav (inactive):** outline pin with flag
- **Profile:** circle + path (person silhouette)
- **Course:** map/polygon
- **Score:** document with lines
- **History:** clock circle
- **Mode — Hole Caddie:** pin with flag polygon + shadow ellipse
- **Mode — Round Plan:** map outline
- **CTA button:** small pin icon, white

---

## Layout Constraints

```css
.app-layout {
  max-width: 480px;
  width: 100%;
  overflow: hidden;   /* prevents content from stretching page width */
}

.app-main {
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
}
```

`overflow: hidden` on the root layout prevents long text (course names, hazard descriptions) from widening the page.

---

## PWA / Bookmark Icons

| File | Size | Usage |
|---|---|---|
| `public/favicon.svg` | SVG | Browser tab icon |
| `public/icon-192.png` | 192×192 | Android home screen / Chrome bookmark |
| `public/icon-512.png` | 512×512 | Splash screen |
| `public/manifest.json` | — | PWA manifest: name "Caddie AI", standalone, dark theme |

Generated via `scripts/gen-icons.mjs` (requires `sharp` dev dependency).
`index.html` links: `rel="icon"`, `rel="apple-touch-icon"`, `rel="manifest"`.

---

## Key Rules

1. **No emojis anywhere** — all replaced with inline SVG icons and pill tags
2. **No light mode** — outdoor app, dark is better in sunlight
3. Cards always have the subtle top highlight border (`border-top-color: rgba(255,255,255,0.06)`)
4. Section labels are plain uppercase text — no left accent bar
5. All SVGs use `currentColor` or hardcoded brand colors from the palette above
6. Mic button is always SVG, never emoji
7. Hole info badge has fixed height (82px) so layout never shifts on hole select
8. `.app-layout` has `overflow: hidden` — prevents any content from widening the page
9. Page title: "Caddie AI" (not "Golf Strategy AI")
10. Auth page header uses `<LogoMark size={72} />` — no emoji
