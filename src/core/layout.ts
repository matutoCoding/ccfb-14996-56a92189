import { clamp, packRgb } from './color'
import { sampleGuideAngle } from './guides'
import { rematchLayout } from './materials'
import { seededRandom } from './rng'
import type { GuideField, LayoutData, LayoutParams, LayoutVersion, Material, Wall } from './types'

export const DEFAULT_LAYOUT_PARAMS: LayoutParams = {
  seed: 'mosaic-master-01',
  tileSizeMm: 14,
  gapMm: 2.5,
  cutRandom: 0.42,
  angleJitterDeg: 8,
  tiltMaxDeg: 7,
  followStrength: 0.78,
  maxColors: 24,
  wastePercent: 6,
}

export const PERFORMANCE_PARAMS: Partial<LayoutParams> = {
  tileSizeMm: 9,
  gapMm: 1,
  cutRandom: 0.38,
  angleJitterDeg: 6,
  tiltMaxDeg: 8,
}

export function createEmptyLayout(wallId: string, params: LayoutParams = DEFAULT_LAYOUT_PARAMS): LayoutData {
  return {
    wallId,
    params: { ...params },
    count: 0,
    positions: new Float32Array(0),
    sizes: new Float32Array(0),
    angles: new Float32Array(0),
    tilts: new Float32Array(0),
    sourceColors: new Uint32Array(0),
    materialCodes: new Uint32Array(0),
    updatedAt: Date.now(),
  }
}

function sampleSourceColor(image: ImageData | null, u: number, v: number): number {
  if (!image) {
    const x = Math.floor(clamp(u, 0, 0.999) * 255)
    const y = Math.floor(clamp(v, 0, 0.999) * 255)
    return packRgb((x + y) / 2, 180 + 40 * Math.sin(u * 8), 220 - y / 2)
  }

  const fx = clamp(u, 0, 1) * (image.width - 1)
  const fy = clamp(v, 0, 1) * (image.height - 1)
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const x1 = Math.min(image.width - 1, x0 + 1)
  const y1 = Math.min(image.height - 1, y0 + 1)
  const tx = fx - x0
  const ty = fy - y0
  const p = image.data
  const i00 = (y0 * image.width + x0) * 4
  const i10 = (y0 * image.width + x1) * 4
  const i01 = (y1 * image.width + x0) * 4
  const i11 = (y1 * image.width + x1) * 4

  const bilinear = (channel: number) => {
    const a = p[i00 + channel] * (1 - tx) + p[i10 + channel] * tx
    const b = p[i01 + channel] * (1 - tx) + p[i11 + channel] * tx
    return a * (1 - ty) + b * ty
  }

  return packRgb(bilinear(0), bilinear(1), bilinear(2))
}

export function estimateTileCount(wall: Wall, params: LayoutParams): number {
  const pitchMm = params.tileSizeMm + params.gapMm
  const cols = Math.floor((wall.widthM * 1000 + params.gapMm + 1e-6) / pitchMm)
  const rows = Math.floor((wall.heightM * 1000 + params.gapMm + 1e-6) / pitchMm)
  return Math.max(0, cols) * Math.max(0, rows)
}

export function generateLayout(
  wall: Wall,
  image: ImageData | null,
  guide: GuideField | null,
  inputParams: LayoutParams,
  materials: Material[],
): LayoutData {
  const params: LayoutParams = { ...inputParams }
  const random = seededRandom(`${params.seed}:${wall.id}:${wall.widthM}:${wall.heightM}:${params.tileSizeMm}:${params.gapMm}:${params.cutRandom}`)
  const pitchMm = params.tileSizeMm + params.gapMm
  const cols = Math.max(1, Math.floor((wall.widthM * 1000 + params.gapMm + 1e-6) / pitchMm))
  const rows = Math.max(1, Math.floor((wall.heightM * 1000 + params.gapMm + 1e-6) / pitchMm))
  const count = cols * rows

  const layout: LayoutData = {
    wallId: wall.id,
    params,
    count,
    positions: new Float32Array(count * 2),
    sizes: new Float32Array(count * 2),
    angles: new Float32Array(count),
    tilts: new Float32Array(count * 2),
    sourceColors: new Uint32Array(count),
    materialCodes: new Uint32Array(count),
    updatedAt: Date.now(),
  }

  const actualWidthMm = cols * params.tileSizeMm + (cols - 1) * params.gapMm
  const actualHeightMm = rows * params.tileSizeMm + (rows - 1) * params.gapMm
  const marginXM = Math.max(0, (wall.widthM * 1000 - actualWidthMm) / 2000)
  const marginYM = Math.max(0, (wall.heightM * 1000 - actualHeightMm) / 2000)
  const pitchM = pitchMm / 1000
  const tileM = params.tileSizeMm / 1000
  const jitterDistance = pitchM * 0.18 * params.cutRandom
  const jitterRad = params.angleJitterDeg * Math.PI / 180
  const tiltRad = params.tiltMaxDeg * Math.PI / 180

  let index = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const baseX = marginXM + col * pitchM + tileM / 2
      const baseY = marginYM + row * pitchM + tileM / 2
      const x = clamp(baseX + (random() - 0.5) * jitterDistance, tileM / 2, wall.widthM - tileM / 2)
      const y = clamp(baseY + (random() - 0.5) * jitterDistance, tileM / 2, wall.heightM - tileM / 2)

      const widthScale = 1 + (random() - 0.5) * 0.34 * params.cutRandom
      const heightScale = 1 + (random() - 0.5) * 0.28 * params.cutRandom
      const w = Math.max(tileM * 0.55, tileM * widthScale)
      const h = Math.max(tileM * 0.55, tileM * heightScale)

      let angle = 0
      if (guide && params.followStrength > 0) {
        const guideAngle = sampleGuideAngle(guide, x / wall.widthM, y / wall.heightM)
        const k = params.followStrength
        angle = 0.5 * Math.atan2(Math.sin(guideAngle * 2) * k, Math.cos(guideAngle * 2) * k + (1 - k))
      }
      angle += (random() - 0.5) * 2 * jitterRad

      const tiltX = (random() - 0.5) * 2 * tiltRad
      const tiltY = (random() - 0.5) * 2 * tiltRad

      layout.positions[index * 2] = x
      layout.positions[index * 2 + 1] = y
      layout.sizes[index * 2] = w
      layout.sizes[index * 2 + 1] = h
      layout.angles[index] = angle
      layout.tilts[index * 2] = tiltX
      layout.tilts[index * 2 + 1] = tiltY
      layout.sourceColors[index] = sampleSourceColor(image, x / wall.widthM, y / wall.heightM)
      index++
    }
  }

  rematchLayout(layout, materials)
  return layout
}

export function cloneLayoutData(layout: LayoutData): LayoutData {
  return {
    ...layout,
    params: { ...layout.params },
    positions: layout.positions.slice(),
    sizes: layout.sizes.slice(),
    angles: layout.angles.slice(),
    tilts: layout.tilts.slice(),
    sourceColors: layout.sourceColors.slice(),
    materialCodes: layout.materialCodes.slice(),
  }
}

export function createVersionFromLayout(layout: LayoutData, versionNumber: number, label: string, auto: boolean): LayoutVersion {
  const copy = cloneLayoutData(layout)
  return {
    ...copy,
    id: `ver_${Date.now().toString(36)}_${versionNumber}`,
    version: versionNumber,
    label,
    createdAt: Date.now(),
    auto,
  }
}

export function restoreVersion(version: LayoutVersion): LayoutData {
  return {
    wallId: version.wallId,
    params: { ...version.params },
    count: version.count,
    positions: version.positions.slice(),
    sizes: version.sizes.slice(),
    angles: version.angles.slice(),
    tilts: version.tilts.slice(),
    sourceColors: version.sourceColors.slice(),
    materialCodes: version.materialCodes.slice(),
    updatedAt: Date.now(),
  }
}

export function findTileAtRough(layout: LayoutData, x: number, y: number, maxDistanceM: number): number {
  let best = -1
  let bestDistance = maxDistanceM * maxDistanceM
  for (let i = 0; i < layout.count; i++) {
    const dx = layout.positions[i * 2] - x
    const dy = layout.positions[i * 2 + 1] - y
    const distance = dx * dx + dy * dy
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  }
  return best
}
