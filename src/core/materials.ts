import { hexToRgb, nearestLabIndex, rgbToLab, unpackRgb, type Lab } from './color'
import type { LayoutData, Material, MaterialUsage, MatchReport } from './types'

interface SeedColor {
  name: string
  hex: string
}

const glassColors: SeedColor[] = [
  { name: '珍珠白玻璃', hex: '#f2eee2' },
  { name: '冰裂白玻璃', hex: '#dce8ee' },
  { name: '天光蓝玻璃', hex: '#7fb4d6' },
  { name: '群青玻璃', hex: '#244a8f' },
  { name: '钴蓝玻璃', hex: '#1769c2' },
  { name: '湖绿玻璃', hex: '#4f9d91' },
  { name: '翡翠绿玻璃', hex: '#167a55' },
  { name: '橄榄绿玻璃', hex: '#7c8a35' },
  { name: '柠黄玻璃', hex: '#e2c84b' },
  { name: '琥珀玻璃', hex: '#d88a24' },
  { name: '橙焰玻璃', hex: '#c8552d' },
  { name: '朱砂红玻璃', hex: '#a92323' },
  { name: '玫瑰紫玻璃', hex: '#b33b5c' },
  { name: '堇紫玻璃', hex: '#63408e' },
  { name: '浅肤玻璃', hex: '#e8b99a' },
  { name: '暖肤玻璃', hex: '#cf8d6d' },
  { name: '深肤玻璃', hex: '#9b5f48' },
  { name: '咖啡玻璃', hex: '#6b4632' },
  { name: '墨色玻璃', hex: '#24272b' },
]

const goldColors: SeedColor[] = [
  { name: '24K亮金箔', hex: '#e0b642' },
  { name: '碎纹金箔', hex: '#c9962e' },
  { name: '香槟金箔', hex: '#e5cf86' },
  { name: '古旧金箔', hex: '#9c7426' },
]

const stoneColors: SeedColor[] = [
  { name: '雪花白大理石', hex: '#e8e5dc' },
  { name: '米黄洞石', hex: '#d2bd93' },
  { name: '浅灰花岗岩', hex: '#a9adb0' },
  { name: '中灰砂岩', hex: '#777d82' },
  { name: '深灰板岩', hex: '#555b60' },
  { name: '黑白根石', hex: '#26282a' },
  { name: '罗马洞石', hex: '#c7a878' },
  { name: '印度红砂岩', hex: '#9c563c' },
  { name: '青灰石板', hex: '#465963' },
]

export function seedMaterials(): Material[] {
  const result: Material[] = []
  let n = 1

  glassColors.forEach((color, i) => {
    result.push({
      id: `mat_glass_${i + 1}`,
      numericCode: n,
      code: `V${String(n).padStart(2, '0')}`,
      name: color.name,
      category: 'glass',
      hex: color.hex,
      opacity: Math.min(0.96, 0.68 + (i % 4) * 0.07),
      roughness: 0.08 + (i % 5) * 0.045,
      reflectivity: 0.62 + (i % 4) * 0.08,
      relief: 0.12 + (i % 4) * 0.08,
      metalness: 0,
      stock: 2600 + ((i * 1733) % 11000),
      safetyStock: 600,
    })
    n++
  })

  goldColors.forEach((color, i) => {
    const code = 101 + i
    result.push({
      id: `mat_gold_${i + 1}`,
      numericCode: code,
      code: `A${code}`,
      name: color.name,
      category: 'gold',
      hex: color.hex,
      opacity: 1,
      roughness: 0.12 + i * 0.055,
      reflectivity: 1,
      relief: 0.28 + i * 0.08,
      metalness: 1,
      stock: 900 + ((i * 2111) % 5200),
      safetyStock: 500,
    })
  })

  stoneColors.forEach((color, i) => {
    const code = 201 + i
    result.push({
      id: `mat_stone_${i + 1}`,
      numericCode: code,
      code: `S${code}`,
      name: color.name,
      category: 'stone',
      hex: color.hex,
      opacity: 1,
      roughness: 0.66 + (i % 4) * 0.08,
      reflectivity: 0.10 + (i % 3) * 0.06,
      relief: 0.38 + (i % 5) * 0.09,
      metalness: 0,
      stock: 1800 + ((i * 1459) % 9000),
      safetyStock: 700,
    })
  })

  return result
}

export function materialLab(material: Material): Lab {
  return rgbToLab(hexToRgb(material.hex))
}

export function rematchLayout(layout: LayoutData, materials: Material[]): MatchReport {
  if (materials.length === 0) throw new Error('材料库为空，无法进行 Lab 颜色匹配')
  const labs = materials.map(materialLab)
  const cache = new Map<number, number>()

  for (let i = 0; i < layout.count; i++) {
    const packed = layout.sourceColors[i]
    let materialIndex = cache.get(packed)
    if (materialIndex === undefined) {
      const rgb = unpackRgb(packed)
      materialIndex = nearestLabIndex(rgbToLab(rgb), labs)
      cache.set(packed, materialIndex)
    }
    layout.materialCodes[i] = materials[materialIndex].numericCode
  }

  return buildMatchReport(layout, materials)
}

export function buildMatchReport(layout: LayoutData, materials: Material[]): MatchReport {
  const byCode = new Map<number, Material>()
  for (const material of materials) byCode.set(material.numericCode, material)

  const counts = new Map<number, number>()
  for (let i = 0; i < layout.count; i++) {
    const code = layout.materialCodes[i]
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }

  const waste = layout.params.wastePercent / 100
  const usages: MaterialUsage[] = []
  let shortagePieces = 0

  for (const [code, count] of counts) {
    const material = byCode.get(code)
    if (!material) continue
    const requiredWithWaste = Math.ceil(count * (1 + waste))
    const shortage = Math.max(0, requiredWithWaste - material.stock)
    shortagePieces += shortage
    usages.push({ material, count, requiredWithWaste, stock: material.stock, shortage })
  }

  usages.sort((a, b) => b.count - a.count)
  const shortageCount = usages.filter((item) => item.shortage > 0).length

  return {
    total: layout.count,
    usedColorCount: usages.length,
    maxColors: layout.params.maxColors,
    tooManyColors: usages.length > layout.params.maxColors,
    usages,
    shortageCount,
    shortagePieces,
  }
}
