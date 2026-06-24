export function LogoMark({ size = 40 }) {
  const s = size / 40
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="20" y1="30" x2="20" y2="10" stroke="white" strokeWidth={2.5 * s} strokeLinecap="round"/>
      <polygon points="20,10 32,15 20,20" fill="#639922"/>
      <ellipse cx="20" cy="31.5" rx="7" ry="2.2" stroke="#3B6D11" strokeWidth="1.2" fill="none"/>
      <circle cx="20" cy="31.5" r="2.2" fill="#97C459"/>
      <line x1="20" y1="29.3" x2="20" y2="24.5" stroke="#97C459" strokeWidth="1.2"/>
      <line x1="20" y1="24.5" x2="26" y2="21.5" stroke="#97C459" strokeWidth="1.2"/>
      <circle cx="26" cy="21.5" r="1.8" fill="#C0DD97"/>
      <line x1="20" y1="24.5" x2="14" y2="21.5" stroke="#97C459" strokeWidth="1.2"/>
      <circle cx="14" cy="21.5" r="1.8" fill="#C0DD97"/>
    </svg>
  )
}

export function LogoHorizontal() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <LogoMark size={36} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--white)',
            lineHeight: 1,
          }}>CADDIE</span>
          <span style={{
            background: '#639922',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.2em',
            color: '#fff',
            lineHeight: 1.4,
          }}>AI</span>
        </div>
        <span style={{
          fontSize: 9,
          letterSpacing: '0.18em',
          color: '#444441',
          fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
          textTransform: 'uppercase',
        }}>Your smart caddie</span>
      </div>
    </div>
  )
}
