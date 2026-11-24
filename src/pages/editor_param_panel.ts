import { h, svgIcon, formatNumber } from '../ui/dom'
import { rangeField, textField } from '../ui/forms'
import { estimateTileCount } from '../core/layout'
import type { LayoutParams, Wall } from '../core/types'

export interface ParamPanel {
  element: HTMLElement
  params: LayoutParams
  sync: (params: LayoutParams) => void
  estimate: () => void
}

export function createParamPanel(
  initial: LayoutParams,
  wall: Wall,
  onGenerate: () => void,
  onPerformance: () => void,
  onRematch: () => void,
  onThresholdChange?: () => void,
): ParamPanel {
  const params: LayoutParams = { ...initial }
  const estimateBadge = h('span', { class: 'badge primary', text: '—' })
  let seedInput: HTMLInputElement | null = null

  const tile = rangeField('单块尺寸', params.tileSizeMm, 6, 42, 1, (v) => { params.tileSizeMm = v; api.estimate() }, (v) => `${v} mm`)
  const gap = rangeField('缝宽', params.gapMm, 0, 10, 0.5, (v) => { params.gapMm = v; api.estimate() }, (v) => `${v} mm`)
  const cut = rangeField('切割随机度', params.cutRandom, 0, 1, 0.01, (v) => { params.cutRandom = v }, (v) => v.toFixed(2))
  const angleJitter = rangeField('角度抖动', params.angleJitterDeg, 0, 30, 0.5, (v) => { params.angleJitterDeg = v }, (v) => `${v.toFixed(1)}°`)
  const tilt = rangeField('最大倾角', params.tiltMaxDeg, 0, 25, 0.5, (v) => { params.tiltMaxDeg = v }, (v) => `${v.toFixed(1)}°`)
  const follow = rangeField('引导线跟随', params.followStrength, 0, 1, 0.01, (v) => { params.followStrength = v }, (v) => v.toFixed(2))
  const maxColors = rangeField('颜色上限', params.maxColors, 8, 64, 1, (v) => { params.maxColors = Math.round(v); onThresholdChange?.() }, (v) => `${Math.round(v)} 种`)
  const waste = rangeField('备料损耗', params.wastePercent, 0, 20, 1, (v) => { params.wastePercent = v; onThresholdChange?.() }, (v) => `${v}%`)

  const api: ParamPanel = {
    element: h('aside', { class: 'card' }, [
      h('div', { class: 'card-title' }, [svgIcon('editor', 19), '排块参数', estimateBadge]),
      h('div', { class: 'field' }, [
        h('label', { class: 'field' }, [h('span', { text: '确定性种子' }), (() => {
          seedInput = h('input', { class: 'input', props: { value: params.seed }, on: { input: (e) => { params.seed = (e.target as HTMLInputElement).value } } }) as HTMLInputElement
          return seedInput
        })()]),
      ]),
      tile, gap, cut, angleJitter, tilt, follow, maxColors, waste,
      h('div', { class: 'button-row mt-4' }, [
        h('button', { class: 'btn btn-primary w-full', on: { click: onGenerate } }, [svgIcon('cube', 16), '按当前参数重新排块']),
        h('button', { class: 'btn', on: { click: onPerformance } }, '20万块压测参数'),
        h('button', { class: 'btn', on: { click: onRematch } }, 'Lab 重新匹配颜色'),
      ]),
      h('div', { class: 'warning-panel mt-4' }, [
        h('strong', { text: '确定性规则' }),
        h('span', { text: '同一墙面、种子、尺寸、缝宽和随机度会得到同一套块；实例化渲染只提交 4 顶点/块。' }),
      ]),
    ]),
    params,
    sync(next: LayoutParams) {
      Object.assign(params, next)
      if (seedInput) seedInput.value = params.seed
      const syncRange = (field: HTMLLabelElement, value: number) => {
        const input = field.querySelector('input[type="range"]') as HTMLInputElement | null
        if (input) {
          input.value = String(value)
          input.dispatchEvent(new Event('input'))
        }
      }
      syncRange(tile, params.tileSizeMm)
      syncRange(gap, params.gapMm)
      syncRange(cut, params.cutRandom)
      syncRange(angleJitter, params.angleJitterDeg)
      syncRange(tilt, params.tiltMaxDeg)
      syncRange(follow, params.followStrength)
      syncRange(maxColors, params.maxColors)
      syncRange(waste, params.wastePercent)
      api.estimate()
    },
    estimate() {
      const count = estimateTileCount(wall, params)
      estimateBadge.textContent = `约 ${formatNumber(count)} 块`
      estimateBadge.className = count >= 180000 ? 'badge danger' : count >= 80000 ? 'badge warning' : 'badge primary'
    },
  }

  api.estimate()
  return api
}
