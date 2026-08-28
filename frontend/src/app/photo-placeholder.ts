/*
 * photo-placeholder.ts — siluet SVG hangat sebagai pengganti foto acara.
 *
 * SEMENTARA. Begitu ada foto hasil booth yang boleh dipakai untuk promosi,
 * ganti pemakaian photoSVG() di section "Yang tamu bawa pulang" dengan
 * <img src="https://cdn.pabrikenangan.my.id/..."> dan hapus berkas ini.
 * Jangan memakai foto tamu tanpa izin tertulis penyelenggara.
 */

const PALETTES = [
  { a: '#FFE3D2', b: '#F09277', ink: '#8C2A1D', glow: '#FFF4E4' },
  { a: '#FFD9DA', b: '#E4707A', ink: '#7C1F2B', glow: '#FFECEC' },
  { a: '#FFEDCB', b: '#E9A63F', ink: '#8A4A16', glow: '#FFF7E6' },
  { a: '#F6DCCB', b: '#C97A5E', ink: '#5E2A1B', glow: '#FBEFE6' },
  { a: '#FFE0C8', b: '#DE6B4F', ink: '#7A2415', glow: '#FFF1E6' },
  { a: '#F3DFE4', b: '#B96C86', ink: '#5C2437', glow: '#FBEEF2' },
]

const SCENES = [
  { n: 2, poses: [1, 2], sc: [1, 0.92], props: 'confetti' },
  { n: 3, poses: [0, 1, 0], sc: [0.86, 1, 0.9], props: 'none' },
  { n: 2, poses: [2, 1], sc: [0.95, 1.02], props: 'hati' },
  { n: 4, poses: [0, 1, 2, 0], sc: [0.8, 0.9, 0.86, 0.78], props: 'confetti' },
  { n: 1, poses: [1], sc: [1.15], props: 'none' },
  { n: 3, poses: [2, 0, 1], sc: [0.9, 1, 0.88], props: 'hati' },
]

function fig(x: number, y: number, s: number, ink: string, pose: number) {
  const o = `fill="${ink}"`
  const head = `<circle cx="${x}" cy="${y - 34 * s}" r="${13 * s}" ${o}/>`
  const body = `<path d="M ${x - 25 * s} ${y} q 0 ${-22 * s} ${25 * s} ${-22 * s}` +
               ` q ${25 * s} 0 ${25 * s} ${22 * s} Z" ${o}/>`
  let arms = ''
  if (pose === 1) {
    arms = `<path d="M ${x - 20 * s} ${y - 14 * s} L ${x - 40 * s} ${y - 48 * s}` +
           ` l ${9 * s} ${6 * s} L ${x - 12 * s} ${y - 6 * s} Z" ${o}/>` +
           `<path d="M ${x + 20 * s} ${y - 14 * s} L ${x + 40 * s} ${y - 48 * s}` +
           ` l ${-9 * s} ${6 * s} L ${x + 12 * s} ${y - 6 * s} Z" ${o}/>`
  } else if (pose === 2) {
    arms = `<path d="M ${x + 18 * s} ${y - 12 * s} L ${x + 44 * s} ${y - 40 * s}` +
           ` l ${8 * s} ${7 * s} L ${x + 11 * s} ${y - 4 * s} Z" ${o}/>`
  }
  return head + body + arms
}

export function photoSVG(i: number): string {
  const p = PALETTES[i % PALETTES.length]
  const s = SCENES[i % SCENES.length]
  const uid = `g${i}`
  let out = '<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">'
  out += `<defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">` +
         `<stop offset="0" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/></linearGradient>` +
         `<radialGradient id="${uid}r" cx="50%" cy="34%" r="52%">` +
         `<stop offset="0" stop-color="${p.glow}" stop-opacity=".85"/>` +
         `<stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient></defs>`
  out += `<rect width="400" height="300" fill="url(#${uid})"/>`
  out += `<ellipse cx="200" cy="104" rx="190" ry="128" fill="url(#${uid}r)"/>`

  const seed = i * 37
  for (let b = 0; b < 7; b++) {
    const bx = (seed * (b + 3) * 17) % 400
    const by = (seed * (b + 5) * 11) % 150
    const br = 7 + ((seed + b * 13) % 16)
    out += `<circle cx="${bx}" cy="${by}" r="${br}" fill="${p.glow}" opacity="${0.1 + (b % 3) * 0.05}"/>`
  }

  if (s.props === 'confetti') {
    for (let c = 0; c < 16; c++) {
      const cx = ((seed * (c + 2) * 23) % 392) + 4
      const cy = ((seed * (c + 7) * 13) % 210) + 6
      const w = 4 + (c % 3) * 2
      out += `<rect x="${cx}" y="${cy}" width="${w}" height="${w * 1.6}" rx="1" ` +
             `fill="${c % 2 ? p.glow : p.ink}" opacity="${c % 2 ? 0.5 : 0.22}" ` +
             `transform="rotate(${((c * 47) % 90) - 45} ${cx} ${cy})"/>`
    }
  } else if (s.props === 'hati') {
    for (let h = 0; h < 3; h++) {
      const hx = 44 + h * 150, hy = 40 + (h % 2) * 26
      out += `<path d="M ${hx} ${hy + 10} l -9 -9 a 6.4 6.4 0 0 1 9 -9 a 6.4 6.4 0 0 1 9 9 Z" fill="${p.glow}" opacity=".55"/>`
    }
  }

  out += `<ellipse cx="200" cy="304" rx="240" ry="46" fill="${p.ink}" opacity=".10"/>`

  const span = 400 / (s.n + 1)
  for (let f = 0; f < s.n; f++) {
    out += fig(span * (f + 1), 268, s.sc[f] * 1.35, p.ink, s.poses[f])
  }
  return out + '</svg>'
}
