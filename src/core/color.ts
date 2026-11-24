export interface RGB {
  r: number
  g: number
  b: number
}

export interface Lab {
  l: number
  a: number
  b: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function hexToRgb(hex: string): RGB {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized
  const int = Number.parseInt(value, 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

export function rgbToHex({ r, g, b }: RGB): string {
  const part = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

export function packRgb(r: number, g: number, b: number): number {
  return ((clamp(r, 0, 255) | 0) << 16) | ((clamp(g, 0, 255) | 0) << 8) | (clamp(b, 0, 255) | 0)
}

export function unpackRgb(packed: number): RGB {
  return { r: (packed >> 16) & 255, g: (packed >> 8) & 255, b: packed & 255 }
}

export function rgbToLab(input: RGB): Lab {
  const sr = input.r / 255
  const sg = input.g / 255
  const sb = input.b / 255
  const gamma = (v: number) => (v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92)
  const r = gamma(sr)
  const g = gamma(sg)
  const b = gamma(sb)

  // sRGB D65 to XYZ
  let x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
  let y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
  let z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041

  x /= 0.95047
  y /= 1.00000
  z /= 1.08883

  const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116)
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

export function deltaE2000(left: Lab, right: Lab): number {
  const rad = Math.PI / 180
  const deg = 180 / Math.PI

  const avgL = (left.l + right.l) / 2
  const c1 = Math.hypot(left.a, left.b)
  const c2 = Math.hypot(right.a, right.b)
  const avgC = (c1 + c2) / 2
  const g = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))))

  const a1p = left.a * (1 + g)
  const a2p = right.a * (1 + g)
  const c1p = Math.hypot(a1p, left.b)
  const c2p = Math.hypot(a2p, right.b)
  const avgCp = (c1p + c2p) / 2

  let h1p = Math.atan2(left.b, a1p) * deg
  if (h1p < 0) h1p += 360
  let h2p = Math.atan2(right.b, a2p) * deg
  if (h2p < 0) h2p += 360

  const avgHp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + 360) / 2 : (h1p + h2p) / 2
  const t = 1
    - 0.17 * Math.cos((avgHp - 30) * rad)
    + 0.24 * Math.cos((2 * avgHp) * rad)
    + 0.32 * Math.cos((3 * avgHp + 6) * rad)
    - 0.20 * Math.cos((4 * avgHp - 63) * rad)

  let deltaHp = h2p - h1p
  if (Math.abs(deltaHp) > 180) deltaHp = h2p <= h1p ? deltaHp + 360 : deltaHp - 360

  const deltaLp = right.l - left.l
  const deltaCp = c2p - c1p
  const deltaHp2 = 2 * Math.sqrt(c1p * c2p) * Math.sin((deltaHp / 2) * rad)

  const sl = 1 + (0.015 * (avgL - 50) ** 2) / Math.sqrt(20 + (avgL - 50) ** 2)
  const sc = 1 + 0.045 * avgCp
  const sh = 1 + 0.015 * avgCp * t
  const deltaTheta = 30 * Math.exp(-(((avgHp - 275) / 25) ** 2))
  const rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)))
  const rt = -Math.sin(2 * deltaTheta * rad) * rc

  return Math.sqrt(
    (deltaLp / sl) ** 2
    + (deltaCp / sc) ** 2
    + (deltaHp2 / sh) ** 2
    + rt * (deltaCp / sc) * (deltaHp2 / sh),
  )
}

export function nearestLabIndex(target: Lab, palette: Lab[]): number {
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let i = 0; i < palette.length; i++) {
    const distance = deltaE2000(target, palette[i])
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  }
  return best
}

export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
