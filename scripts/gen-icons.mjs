import sharp from 'sharp'

const svgMark = (size) => {
  const s = size / 192
  const r = Math.round(size * 0.198)
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${r}" fill="#111f17"/>
  <line x1="${size*0.5}" y1="${size*0.75}" x2="${size*0.5}" y2="${size*0.25}" stroke="white" stroke-width="${Math.round(12*s)}" stroke-linecap="round"/>
  <polygon points="${size*0.5},${size*0.25} ${size*0.802},${size*0.375} ${size*0.5},${size*0.5}" fill="#639922"/>
  <ellipse cx="${size*0.5}" cy="${size*0.786}" rx="${size*0.177}" ry="${size*0.057}" stroke="#3B6D11" stroke-width="${Math.round(6*s)}" fill="none"/>
  <circle cx="${size*0.5}" cy="${size*0.786}" r="${size*0.057}" fill="#97C459"/>
  <line x1="${size*0.5}" y1="${size*0.734}" x2="${size*0.5}" y2="${size*0.615}" stroke="#97C459" stroke-width="${Math.round(6*s)}"/>
  <line x1="${size*0.5}" y1="${size*0.615}" x2="${size*0.651}" y2="${size*0.536}" stroke="#97C459" stroke-width="${Math.round(6*s)}"/>
  <circle cx="${size*0.651}" cy="${size*0.536}" r="${size*0.047}" fill="#C0DD97"/>
  <line x1="${size*0.5}" y1="${size*0.615}" x2="${size*0.349}" y2="${size*0.536}" stroke="#97C459" stroke-width="${Math.round(6*s)}"/>
  <circle cx="${size*0.349}" cy="${size*0.536}" r="${size*0.047}" fill="#C0DD97"/>
</svg>`
}

await Promise.all([
  sharp(Buffer.from(svgMark(192))).png().toFile('public/icon-192.png'),
  sharp(Buffer.from(svgMark(512))).png().toFile('public/icon-512.png'),
])

console.log('Icons generated: public/icon-192.png, public/icon-512.png')
