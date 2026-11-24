import type { Wall } from './types'

export interface Ray {
  origin: [number, number, number]
  direction: [number, number, number]
}

export interface WallPoint {
  x: number
  y: number
  t: number
}

export function wallArea(wall: Wall): number {
  return wall.widthM * wall.heightM
}

export function effectiveRadius(wall: Wall): number {
  if (wall.radiusM > 0) return wall.radiusM
  if (wall.shape === 'dome') return wall.widthM / Math.PI
  return wall.widthM / 2
}

function quadraticHit(a: number, b: number, c: number): number | null {
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0 || Math.abs(a) < 1e-10) return null
  const root = Math.sqrt(discriminant)
  const t1 = (-b - root) / (2 * a)
  const t2 = (-b + root) / (2 * a)
  if (t1 > 1e-5) return t1
  if (t2 > 1e-5) return t2
  return null
}

export function intersectWallRay(wall: Wall, ray: Ray): WallPoint | null {
  const [ox, oy, oz0] = ray.origin
  const [dx, dy, dz] = ray.direction

  if (wall.shape === 'flat') {
    if (Math.abs(dz) < 1e-8) return null
    const t = -oz0 / dz
    if (t < 0) return null
    const x = ox + dx * t
    const y = oy + dy * t
    return { x: x + wall.widthM / 2, y: wall.heightM / 2 - y, t }
  }

  const radius = effectiveRadius(wall)

  if (wall.shape === 'curved') {
    const cz = oz0 + radius
    const a = dx * dx + dz * dz
    const b = 2 * (ox * dx + cz * dz)
    const c = ox * ox + cz * cz - radius * radius
    const t = quadraticHit(a, b, c)
    if (t === null) return null
    const px = ox + dx * t
    const py = oy + dy * t
    const pz = oz0 + dz * t
    const theta = Math.atan2(px, pz + radius)
    return { x: wall.widthM / 2 + theta * radius, y: wall.heightM / 2 - py, t }
  }

  // 半穹顶按椭球求交：水平半径 radius，竖向半径 wall.heightM。
  const sox = ox / radius
  const sdx = dx / radius
  const soy = (oy + wall.heightM / 2) / wall.heightM
  const sdy = dy / wall.heightM
  const soz = (oz0 + radius) / radius
  const sdz = dz / radius

  const a = sdx * sdx + sdy * sdy + sdz * sdz
  const b = 2 * (sox * sdx + soy * sdy + soz * sdz)
  const c = sox * sox + soy * soy + soz * soz - 1
  const t = quadraticHit(a, b, c)
  if (t === null) return null

  const px = ox + dx * t
  const py = oy + dy * t
  const pz = oz0 + dz * t
  const theta = Math.atan2(px, pz + radius)
  return { x: wall.widthM / 2 + theta * radius, y: wall.heightM / 2 - py, t }
}

export interface MeterSheet {
  index: number
  col: number
  row: number
  x0: number
  y0: number
  x1: number
  y1: number
  label: string
  area: number
}

export function getMeterSheets(wall: Wall): MeterSheet[] {
  const cols = Math.max(1, Math.ceil(wall.widthM - 1e-6))
  const rows = Math.max(1, Math.ceil(wall.heightM - 1e-6))
  const sheets: MeterSheet[] = []
  let index = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col
      const y0 = row
      const x1 = Math.min(wall.widthM, col + 1)
      const y1 = Math.min(wall.heightM, row + 1)
      sheets.push({
        index: index++,
        col,
        row,
        x0,
        y0,
        x1,
        y1,
        label: `${String.fromCharCode(65 + Math.min(col, 25))}${row + 1}`,
        area: (x1 - x0) * (y1 - y0),
      })
    }
  }
  return sheets
}

export function clampToWall(wall: Wall, x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(wall.widthM, Math.max(0, x)),
    y: Math.min(wall.heightM, Math.max(0, y)),
  }
}
