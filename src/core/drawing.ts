import { luminance } from './color'
import type { MeterSheet } from './geometry'
import type { LayoutData, Material, Wall } from './types'

export interface SheetRenderOptions {
  wall: Wall
  layout: LayoutData
  materials: Material[]
  sheet: MeterSheet
  pixelsPerM?: number
}

export function renderSheetCanvas(options: SheetRenderOptions): HTMLCanvasElement {
  const { wall, layout, sheet } = options
  const ppm = options.pixelsPerM ?? 1800
  const widthM = sheet.x1 - sheet.x0
  const heightM = sheet.y1 - sheet.y0
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(64, Math.round(widthM * ppm))
  canvas.height = Math.max(64, Math.round(heightM * ppm))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建施工图画布')

  const materialByCode = new Map(options.materials.map((m) => [m.numericCode, m]))
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, canvas.width, canvas.height)
  ctx.clip()
  ctx.scale(ppm, ppm)
  ctx.translate(-sheet.x0, -sheet.y0)

  // 10 厘米辅助网格
  ctx.lineWidth = 0.00045
  ctx.strokeStyle = '#dbe3ec'
  const gridStep = 0.1
  const startX = Math.ceil(sheet.x0 / gridStep) * gridStep
  const startY = Math.ceil(sheet.y0 / gridStep) * gridStep
  ctx.beginPath()
  for (let x = startX; x <= sheet.x1 + 1e-6; x += gridStep) {
    ctx.moveTo(x, sheet.y0)
    ctx.lineTo(x, sheet.y1)
  }
  for (let y = startY; y <= sheet.y1 + 1e-6; y += gridStep) {
    ctx.moveTo(sheet.x0, y)
    ctx.lineTo(sheet.x1, y)
  }
  ctx.stroke()

  for (let i = 0; i < layout.count; i++) {
    const cx = layout.positions[i * 2]
    const cy = layout.positions[i * 2 + 1]
    const w = layout.sizes[i * 2]
    const h = layout.sizes[i * 2 + 1]
    const radius = Math.hypot(w, h) / 2 + 0.01
    if (cx + radius < sheet.x0 || cx - radius > sheet.x1 || cy + radius < sheet.y0 || cy - radius > sheet.y1) continue

    const angle = layout.angles[i]
    const code = layout.materialCodes[i]
    const material = materialByCode.get(code)
    const fill = material?.hex ?? '#ff00ff'

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.rect(-w / 2, -h / 2, w, h)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.lineWidth = Math.max(0.00045, (layout.params.gapMm / 1000) * 0.22)
    ctx.strokeStyle = 'rgba(30, 27, 23, .72)'
    ctx.stroke()
    ctx.restore()

    const rgb = material ? hexToRgbSafe(material.hex) : { r: 255, g: 0, b: 255 }
    const darkText = luminance(rgb.r, rgb.g, rgb.b) > 145
    const fontSize = Math.max(0.0026, Math.min(w, h) * 0.31)
    ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = darkText ? 'rgba(15,23,42,.92)' : 'rgba(255,255,255,.96)'
    const label = material?.code ?? String(code)
    ctx.fillText(label, cx, cy + fontSize * 0.06, Math.max(w * 0.92, 0.004))

    const tilt = Math.hypot(layout.tilts[i * 2], layout.tilts[i * 2 + 1])
    if (tilt > 0.07) {
      ctx.beginPath()
      ctx.arc(cx + w * 0.34, cy - h * 0.34, Math.max(0.0016, Math.min(w, h) * 0.08), 0, Math.PI * 2)
      ctx.fillStyle = '#0f172a'
      ctx.fill()
    }
  }

  ctx.restore()
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 3
  ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3)

  ctx.fillStyle = '#0f172a'
  ctx.font = `600 ${Math.round(ppm * 0.026)}px system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(`${sheet.label} · ${sheet.x0}-${sheet.x1}m × ${sheet.y0}-${sheet.y1}m`, Math.round(ppm * 0.025), Math.round(ppm * 0.018))

  return canvas
}

function hexToRgbSafe(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace('#', '')
  const int = Number.parseInt(value.length === 3 ? value.split('').map((c) => c + c).join('') : value, 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

export function bomCsv(rows: Array<{ code: string; name: string; category: string; count: number; requiredWithWaste: number; stock: number; shortage: number }>): string {
  const header = ['颜色编号', '材料名称', '分类', '净用量(块)', '含损耗需求(块)', '库存(块)', '缺口(块)']
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  return '﻿' + [header, ...rows.map((row) => [row.code, row.name, row.category, row.count, row.requiredWithWaste, row.stock, row.shortage])]
    .map((row) => row.map(escape).join(','))
    .join('\n')}
