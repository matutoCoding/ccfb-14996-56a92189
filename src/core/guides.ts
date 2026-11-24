import { clamp } from './color'
import { seededRandom } from './rng'
import type { GuideField, GuideLine, SourceRecord, Wall } from './types'

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('原稿图片加载失败'))
    image.src = src
  })
}

export async function rasterizeSource(
  source: SourceRecord,
  wall: Wall,
  maxDimension = 560,
): Promise<ImageData> {
  const image = await loadImage(source.dataUrl)
  const aspect = wall.widthM / wall.heightM
  const targetW = aspect >= 1 ? maxDimension : Math.round(maxDimension * aspect)
  const targetH = aspect >= 1 ? Math.round(maxDimension / aspect) : maxDimension
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(32, targetW)
  canvas.height = Math.max(32, targetH)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法创建原稿处理画布')

  const sourceAspect = image.width / image.height
  let sx = 0
  let sy = 0
  let sw = image.width
  let sh = image.height
  if (sourceAspect > aspect) {
    sw = image.height * aspect
    sx = (image.width - sw) / 2
  } else {
    sh = image.width / aspect
    sy = (image.height - sh) / 2
  }

  ctx.filter = `brightness(${source.brightness}%) contrast(${source.contrast}%)`
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

interface SkinBox {
  cx: number
  cy: number
  rx: number
  ry: number
  count: number
}

function detectSkin(data: Uint8ClampedArray, width: number, height: number): SkinBox | null {
  let sx = 0
  let sy = 0
  let sumXX = 0
  let sumYY = 0
  let count = 0

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const isSkin = r > 95 && g > 45 && b > 25 && max - min > 18 && Math.abs(r - g) > 12 && r > g && g >= b - 12
      if (!isSkin) continue
      sx += x
      sy += y
      sumXX += x * x
      sumYY += y * y
      count++
    }
  }

  if (count < width * height * 0.006) return null
  const cx = sx / count
  const cy = sy / count
  const varianceX = Math.max(1, sumXX / count - cx * cx)
  const varianceY = Math.max(1, sumYY / count - cy * cy)
  return {
    cx,
    cy,
    rx: Math.sqrt(varianceX) * 2.2,
    ry: Math.sqrt(varianceY) * 2.4,
    count,
  }
}

function smoothField(cos2: Float32Array, sin2: Float32Array, width: number, height: number): void {
  for (let pass = 0; pass < 2; pass++) {
    const oldCos = Float32Array.from(cos2)
    const oldSin = Float32Array.from(sin2)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let c = 0
        let s = 0
        let n = 0
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const idx = (y + oy) * width + (x + ox)
            c += oldCos[idx]
            s += oldSin[idx]
            n++
          }
        }
        const idx = y * width + x
        cos2[idx] = c / n
        sin2[idx] = s / n
      }
    }
  }
}

export function analyzeGuides(
  image: ImageData,
  options: { edgeSensitivity: number; guideDensity: number; faceFlow: number },
): GuideField {
  const width = image.width
  const height = image.height
  const data = image.data
  const gray = new Float32Array(width * height)

  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]
  }

  const cos2 = new Float32Array(width * height)
  const sin2 = new Float32Array(width * height)
  const strength = new Float32Array(width * height)
  const skin = detectSkin(data, width, height)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const tl = gray[i - width - 1]
      const tc = gray[i - width]
      const tr = gray[i - width + 1]
      const ml = gray[i - 1]
      const mr = gray[i + 1]
      const bl = gray[i + width - 1]
      const bc = gray[i + width]
      const br = gray[i + width + 1]
      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br
      const mag = Math.hypot(gx, gy) / 1020
      const contourAngle = Math.atan2(gy, gx) + Math.PI / 2

      let weight = Math.min(1, mag * (1.2 + options.edgeSensitivity * 2.4)) + 0.08
      let angle = contourAngle

      if (skin && options.faceFlow > 0) {
        const dx = (x - skin.cx) / Math.max(8, skin.rx)
        const dy = (y - skin.cy) / Math.max(8, skin.ry)
        const dist = Math.hypot(dx, dy)
        if (dist < 1.45) {
          const falloff = clamp(1 - dist / 1.45, 0, 1)
          const nx = dx / Math.max(8, skin.rx)
          const ny = dy / Math.max(8, skin.ry)
          const faceAngle = Math.atan2(ny, nx) + Math.PI / 2
          const faceWeight = falloff * options.faceFlow * 1.8
          const fc = Math.cos(faceAngle * 2) * faceWeight
          const fs = Math.sin(faceAngle * 2) * faceWeight
          const ec = Math.cos(angle * 2) * weight
          const es = Math.sin(angle * 2) * weight
          angle = 0.5 * Math.atan2(es + fs, ec + fc)
          weight += faceWeight * 0.35
        }
      }

      cos2[i] = Math.cos(angle * 2) * weight
      sin2[i] = Math.sin(angle * 2) * weight
      strength[i] = mag
    }
  }

  smoothField(cos2, sin2, width, height)

  const field: GuideField = { cols: width, rows: height, angle: new Float32Array(width * height), strength, lines: [] }
  for (let i = 0; i < field.angle.length; i++) {
    field.angle[i] = 0.5 * Math.atan2(sin2[i], cos2[i])
  }

  field.lines = buildStreamlines(field, options.guideDensity, options.edgeSensitivity, skin)
  return field
}

export function sampleGuideAngle(field: GuideField, u: number, v: number): number {
  const x = clamp(u, 0, 1) * (field.cols - 1)
  const y = clamp(v, 0, 1) * (field.rows - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(field.cols - 1, x0 + 1)
  const y1 = Math.min(field.rows - 1, y0 + 1)
  const tx = x - x0
  const ty = y - y0

  function doubleAt(ix: number, iy: number): [number, number] {
    const a = field.angle[iy * field.cols + ix] * 2
    const w = 0.25 + field.strength[iy * field.cols + ix] * 4
    return [Math.cos(a) * w, Math.sin(a) * w]
  }

  const c00 = doubleAt(x0, y0)
  const c10 = doubleAt(x1, y0)
  const c01 = doubleAt(x0, y1)
  const c11 = doubleAt(x1, y1)
  const c0 = c00[0] * (1 - tx) + c10[0] * tx
  const s0 = c00[1] * (1 - tx) + c10[1] * tx
  const c1 = c01[0] * (1 - tx) + c11[0] * tx
  const s1 = c01[1] * (1 - tx) + c11[1] * tx
  return 0.5 * Math.atan2(s0 * (1 - ty) + s1 * ty, c0 * (1 - ty) + c1 * ty)
}

function buildStreamlines(
  field: GuideField,
  density: number,
  sensitivity: number,
  skin: SkinBox | null,
): GuideLine[] {
  const lines: GuideLine[] = []
  const seedCountX = Math.round(9 + density * 18)
  const seedCountY = Math.round(seedCountX * field.rows / field.cols)
  const random = seededRandom(`guides:${density}:${sensitivity}`)
  const step = 2.2 / Math.max(field.cols, field.rows)
  const maxSteps = 150

  for (let sy = 0; sy < seedCountY; sy++) {
    for (let sx = 0; sx < seedCountX; sx++) {
      const jitterX = (random() - 0.5) * 0.55
      const jitterY = (random() - 0.5) * 0.55
      const startX = (sx + 0.5 + jitterX) / seedCountX
      const startY = (sy + 0.5 + jitterY) / seedCountY
      if (startX < 0.02 || startX > 0.98 || startY < 0.02 || startY > 0.98) continue

      const points: Array<{ x: number; y: number }> = []
      let x = startX
      let y = startY
      let previousAngle: number | null = null

      for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
        if (x < 0.01 || x > 0.99 || y < 0.01 || y > 0.99) break
        let angle = sampleGuideAngle(field, x, y)
        if (previousAngle !== null) {
          const dx = Math.cos(angle)
          const dy = Math.sin(angle)
          const pdx = Math.cos(previousAngle)
          const pdy = Math.sin(previousAngle)
          if (dx * pdx + dy * pdy < 0) angle += Math.PI
        }
        previousAngle = angle
        points.push({ x, y })
        x += Math.cos(angle) * step
        y += Math.sin(angle) * step
      }

      if (points.length < 10) continue
      const px = Math.floor(startX * (field.cols - 1))
      const py = Math.floor(startY * (field.rows - 1))
      const strength = field.strength[py * field.cols + px]
      let kind: GuideLine['kind'] = strength > 0.10 + sensitivity * 0.08 ? 'contour' : 'flow'
      if (skin) {
        const dx = (startX * field.cols - skin.cx) / Math.max(8, skin.rx)
        const dy = (startY * field.rows - skin.cy) / Math.max(8, skin.ry)
        if (Math.hypot(dx, dy) < 1.2) kind = 'face'
      }
      lines.push({ kind, points })
    }
  }
  return lines
}
