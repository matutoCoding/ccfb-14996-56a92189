import { h, svgIcon, toast, downloadText } from '../ui/dom'
import { rangeField, selectField } from '../ui/forms'
import { wallPicker } from '../ui/wall_context'
import { getLayout, getWall, listMaterials } from '../state/store'
import { formatNumber } from '../ui/dom'
import { effectiveRadius } from '../core/geometry'
import type { LightPresetId, LightSettings } from '../core/types'
import { MosaicRenderer } from '../render/renderer'
import { attachPreviewControls } from './canvas_controls'

const presetName: Record<LightPresetId, string> = {
  daylight: '白天自然光',
  spot: '酒店射灯',
  candle: '教堂蜡烛',
}

export async function renderPreview(container: HTMLElement, query: URLSearchParams): Promise<{ destroy: () => void }> {
  const wallId = query.get('wall') ?? undefined
  const picker = await wallPicker(wallId, '#/preview')
  if (!wallId) {
    container.replaceChildren(h('div', { class: 'card' }, [picker, h('div', { class: 'empty-state' }, ['请先选择一面墙。'])]))
    return { destroy: () => undefined }
  }

  const [wall, layout, materials] = await Promise.all([getWall(wallId), getLayout(wallId), listMaterials()])
  if (!wall) {
    container.replaceChildren(h('div', { class: 'card empty-state' }, ['墙面不存在。']))
    return { destroy: () => undefined }
  }

  if (!layout || layout.count === 0) {
    container.replaceChildren(h('div', { class: 'grid' }, [
      h('div', { class: 'card' }, [picker]),
      h('div', { class: 'card empty-state' }, [
        h('div', { class: 'empty-icon' }, [svgIcon('preview', 30)]),
        h('h2', { text: '还没有可预览的排块' }),
        h('p', { text: '先到排块编辑页生成一套块，再回到这里检查真实光照、金箔闪烁和死白区域。' }),
        h('a', { class: 'btn btn-primary', attrs: { href: `#/editor?wall=${wall.id}` } }, '去生成排块'),
      ]),
    ]))
    return { destroy: () => undefined }
  }

  const settings: LightSettings = {
    preset: 'daylight',
    intensity: 1.15,
    warm: 0.28,
    showBlown: false,
    timeOfDay: 10.5,
  }

  const canvas = h('canvas', { attrs: { 'aria-label': '墙面光照预览 WebGL 画布' } }) as HTMLCanvasElement
  const presetPill = h('span', { class: 'status-pill', text: presetName[settings.preset] })
  const countPill = h('span', { class: 'status-pill', text: `${formatNumber(layout.count)} 块` })
  const blownPill = h('span', { class: 'status-pill', text: '死白标记关' })
  let renderer: MosaicRenderer | null = null
  let cleanup: (() => void) | null = null
  let walkRaf = 0
  let walking = false
  let destroyed = false

  const intensity = rangeField('光源强度', settings.intensity, 0.35, 2.2, 0.05, (v) => { settings.intensity = v; renderer?.setLightSettings(settings) }, (v) => `${v.toFixed(2)}×`)
  const warmth = rangeField('暖色比例', settings.warm, 0, 1, 0.01, (v) => { settings.warm = v; renderer?.setLightSettings(settings) }, (v) => v.toFixed(2))
  const daylightHour = rangeField('白天时刻', settings.timeOfDay, 6, 18, 0.25, (v) => { settings.timeOfDay = v; renderer?.setLightSettings(settings) }, (v) => `${Math.floor(v)}:${v % 1 ? '30' : '00'}`)

  const presetSelect = selectField<LightPresetId>('光源环境', settings.preset, [
    { value: 'daylight', label: '白天自然光（按朝向）' },
    { value: 'spot', label: '射灯 / 洗墙灯' },
    { value: 'candle', label: '蜡烛暖光' },
  ], (value) => {
    settings.preset = value
    presetPill.textContent = presetName[value]
    renderer?.setLightSettings(settings)
  })

  const blownButton = h('button', {
    class: 'btn',
    text: '标出死白区域',
    on: {
      click: () => {
        settings.showBlown = !settings.showBlown
        blownButton.classList.toggle('btn-danger', settings.showBlown)
        blownButton.textContent = settings.showBlown ? '关闭死白标记' : '标出死白区域'
        blownPill.textContent = settings.showBlown ? '死白标记开' : '死白标记关'
        renderer?.setLightSettings(settings)
      },
    },
  })

  const walkButton = h('button', {
    class: 'btn',
    text: '模拟人走过',
    on: {
      click: () => {
        walking = !walking
        walkButton.classList.toggle('btn-primary', walking)
        walkButton.textContent = walking ? '停止走动' : '模拟人走过'
        if (walking) {
          const start = performance.now()
          const tick = (now: number) => {
            if (!walking || !renderer || destroyed) return
            const t = (now - start) / 1000
            renderer.camera.yaw = Math.sin(t * 0.42) * 0.62
            renderer.camera.pitch = 0.08 + Math.sin(t * 0.23) * 0.025
            walkRaf = requestAnimationFrame(tick)
          }
          walkRaf = requestAnimationFrame(tick)
        } else {
          cancelAnimationFrame(walkRaf)
        }
      },
    },
  })

  container.replaceChildren(
    h('div', { class: 'grid' }, [
      h('div', { class: 'topbar', style: 'position:static;padding:0;border:0;background:none' }, [
        h('div', {}, [h('div', { class: 'crumb', text: '墙面预览 / 实时光照' }), h('h1', { text: wall.name })]),
        h('div', { class: 'topbar-actions' }, [picker, h('a', { class: 'btn', attrs: { href: `#/editor?wall=${wall.id}` } }, '回排块编辑')]),
      ]),
      h('div', { class: 'layout-preview' }, [
        h('aside', { class: 'card' }, [
          h('div', { class: 'card-title' }, [svgIcon('preview', 19), '光照控制台']),
          presetSelect,
          intensity,
          warmth,
          settings.preset === 'daylight' ? daylightHour : h('div', {}),
          h('div', { class: 'button-row mt-3' }, [blownButton, walkButton]),
          h('div', { class: 'button-row mt-2' }, [
            h('button', { class: 'btn', on: { click: () => renderer?.camera.fit(wall.widthM, wall.heightM, effectiveRadius(wall) * 0.45) } }, '重置视角'),
            h('button', {
              class: 'btn',
              on: {
                click: () => {
                  if (!renderer) return
                  const url = renderer.screenshotDataUrl()
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${wall.name}-光照预览.png`
                  a.click()
                },
              },
            }, '保存截图'),
            h('button', {
              class: 'btn btn-ghost',
              on: { click: () => downloadText('light-settings.json', JSON.stringify({ wall, settings }, null, 2), 'application/json') },
            }, '导出参数'),
          ]),
          h('div', { class: 'warning-panel mt-4' }, [
            h('strong', { text: '为什么会一片死白？' }),
            h('span', { text: '每块玻璃都有独立微法线和倾角；当视角半向量、灯光方向与某块的反射峰重合时会形成高光。密集低粗糙度块在射灯下可能连成过曝带。' }),
          ]),
          h('div', { class: 'section-label', text: '墙面信息' }),
          h('div', { class: 'material-props' }, [
            h('span', { text: `形态：${wall.shape}` }),
            h('span', { text: `朝向：${wall.orientationDeg}°` }),
            h('span', { text: `尺寸：${wall.widthM}×${wall.heightM}m` }),
            h('span', { text: wall.shape === 'flat'
              ? '平面墙，无曲率'
              : `曲率半径：${wall.radiusM > 0 ? wall.radiusM : effectiveRadius(wall).toFixed(2) + '（自动）'}m` }),
          ]),
        ]),
        h('section', { class: 'canvas-shell' }, [
          canvas,
          h('div', { class: 'canvas-status' }, [presetPill, countPill, blownPill]),
          h('div', { class: 'canvas-hint', text: '拖动旋转视角；金箔闪光由视角相关的半向量高光产生，点“模拟人走过”可观察闪光跟随视线变化。' }),
        ]),
      ]),
    ]),
  )

  try {
    renderer = new MosaicRenderer(canvas, wall)
    renderer.setLayout(layout, materials)
    renderer.setLightSettings(settings)
    cleanup = attachPreviewControls(canvas, renderer)
  } catch (error) {
    console.error(error)
    toast((error as Error).message, 'error')
  }

  return {
    destroy: () => {
      destroyed = true
      walking = false
      cancelAnimationFrame(walkRaf)
      cleanup?.()
      renderer?.dispose()
    },
  }
}
