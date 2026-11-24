import { formatNumber, h, svgIcon, toast } from '../ui/dom'
import { wallPicker } from '../ui/wall_context'
import {
  commitLayoutVersion,
  getLayout,
  getSourceForWall,
  getWall,
  listMaterials,
  listVersions,
  restoreVersionById,
  saveLayout,
  saveMaterial,
} from '../state/store'
import { analyzeGuides, rasterizeSource } from '../core/guides'
import { buildMatchReport, rematchLayout } from '../core/materials'
import { DEFAULT_LAYOUT_PARAMS, PERFORMANCE_PARAMS, generateLayout } from '../core/layout'
import type { GuideField, LayoutData, MatchReport, Material, Wall } from '../core/types'
import { MosaicRenderer } from '../render/renderer'
import { attachEditorControls } from './canvas_controls'
import { createParamPanel } from './editor_param_panel'
import { historyList, inspectorEmpty, reportPanel } from './editor_panels'
import { renderInspector } from './editor_inspector'

export async function renderEditor(container: HTMLElement, query: URLSearchParams): Promise<{ destroy: () => void }> {
  const wallId = query.get('wall') ?? undefined
  const picker = await wallPicker(wallId, '#/editor')
  if (!wallId) {
    container.replaceChildren(h('div', { class: 'card' }, [picker, h('div', { class: 'empty-state' }, ['请先选择一面墙。'])]))
    return { destroy: () => undefined }
  }

  const loadedWall = await getWall(wallId)
  if (!loadedWall) {
    container.replaceChildren(h('div', { class: 'card empty-state' }, ['墙面不存在。']))
    return { destroy: () => undefined }
  }
  const wall: Wall = loadedWall

  const [materials, source, savedLayout, versions] = await Promise.all([
    listMaterials(), getSourceForWall(wall.id), getLayout(wall.id), listVersions(wall.id),
  ])

  let layout: LayoutData | null = savedLayout ?? null
  let report: MatchReport | null = layout ? buildMatchReport(layout, materials) : null
  let renderer: MosaicRenderer | null = null
  let guide: GuideField | null = null
  let orbitMode = false
  let selected = -1
  let destroyed = false
  let cleanupControls: (() => void) | null = null
  let fpsRaf = 0

  const canvas = h('canvas', { attrs: { 'aria-label': '排块编辑 WebGL 画布' } }) as HTMLCanvasElement
  const countPill = h('span', { class: 'status-pill', text: layout ? `${formatNumber(layout.count)} 块` : '未排块' })
  const fpsPill = h('span', { class: 'status-pill', text: '— FPS' })
  const modePill = h('span', { class: 'status-pill', text: '选择模式' })
  const inspectorHost = h('div', {}, [inspectorEmpty()])
  const reportHost = h('div', {}, [reportPanel(report, materials)])
  const historyHost = h('div')
  const orbitButton = h('button', { class: 'btn sm btn-dark', text: '切换环视', on: { click: () => { orbitMode = !orbitMode; modePill.textContent = orbitMode ? '环视模式' : '选择模式'; orbitButton.textContent = orbitMode ? '切回选择' : '切换环视' } } })

  const paramPanel = createParamPanel(layout?.params ?? DEFAULT_LAYOUT_PARAMS, wall,
    () => { void generate(false) },
    () => {
      Object.assign(paramPanel.params, PERFORMANCE_PARAMS)
      paramPanel.sync(paramPanel.params)
      void generate(true)
    },
    () => { void rematch() },
    () => {
      if (!layout) return
      layout.params.maxColors = paramPanel.params.maxColors
      layout.params.wastePercent = paramPanel.params.wastePercent
      refreshReport()
    },
  )

  async function loadGuide(): Promise<GuideField | null> {
    if (!source) return null
    const imageData = await rasterizeSource(source, wall as Wall, 512)
    guide = analyzeGuides(imageData, {
      edgeSensitivity: source.edgeSensitivity,
      guideDensity: source.guideDensity,
      faceFlow: source.faceFlow,
    })
    return guide
  }

  async function refreshHistory(): Promise<void> {
    const items = await listVersions(wall.id)
    historyHost.replaceChildren(historyList(items, (version) => { void restore(version.id, version.version) }))
  }

  function refreshReport(): void {
    report = layout ? buildMatchReport(layout, materials as Material[]) : null
    reportHost.replaceChildren(reportPanel(report, materials))
    countPill.textContent = layout ? `${formatNumber(layout.count)} 块` : '未排块'
  }

  function refreshInspector(): void {
    if (!layout || selected < 0) {
      inspectorHost.replaceChildren(inspectorEmpty())
      return
    }
    inspectorHost.replaceChildren(renderInspector({
      layout,
      index: selected,
      materials,
      onMaterialChange: () => {
        renderer?.refreshTileMaterial(selected)
        refreshReport()
        void saveLayout(layout as LayoutData)
      },
      onCustomColor: async (hex: string) => {
        if (!layout || selected < 0) return
        let material = materials.find((item) => item.hex.toLowerCase() === hex.toLowerCase())
        if (!material) {
          const numericCode = Math.max(0, ...materials.map((item) => item.numericCode)) + 1
          material = {
            id: `mat_custom_${numericCode}_${Date.now().toString(36)}`,
            numericCode,
            code: `X${numericCode}`,
            name: `自定义颜色 ${hex}`,
            category: 'glass',
            hex,
            opacity: 0.92,
            roughness: 0.16,
            reflectivity: 0.78,
            relief: 0.2,
            metalness: 0,
            stock: 0,
            safetyStock: 0,
          }
          materials.push(material)
          await saveMaterial(material)
          renderer?.addMaterial(material)
        }
        layout.materialCodes[selected] = material.numericCode
        renderer?.refreshTileMaterial(selected)
        refreshReport()
        void saveLayout(layout)
        toast(`#${selected + 1} 已改为 ${material.code}`, 'success')
      },
      onTransformChange: () => renderer?.uploadTileTransform(selected),
      onSaveVersion: () => { void saveVersion(`修改 #${selected + 1} 的材料 / 角度`) },
    }))
  }

  function selectTile(index: number): void {
    selected = index
    renderer?.setSelected(index)
    refreshInspector()
  }

  async function saveVersion(label: string): Promise<void> {
    if (!layout) return
    await commitLayoutVersion(layout, label, false)
    await refreshHistory()
    toast('已写入版本历史', 'success')
  }

  async function generate(performanceRun: boolean): Promise<void> {
    try {
      countPill.textContent = performanceRun ? '正在生成压测排块…' : '正在分析并生成…'
      await new Promise((resolve) => window.setTimeout(resolve, 60))
      const field = await loadGuide()
      const generated = generateLayout(wall, source ? await rasterizeSource(source, wall, 512) : null, field, paramPanel.params, materials)
      layout = generated
      report = buildMatchReport(layout, materials)
      selected = -1
      renderer?.setSelected(-1)
      renderer?.setLayout(layout, materials)
      refreshReport()
      refreshInspector()
      await commitLayoutVersion(layout, performanceRun ? '20万块性能压测排块' : '按参数自动排块', true)
      await refreshHistory()
      toast(`已生成 ${formatNumber(layout.count)} 块，同参数可复现`, 'success')
    } catch (error) {
      console.error(error)
      toast((error as Error).message, 'error')
    }
  }

  async function rematch(): Promise<void> {
    if (!layout) {
      toast('请先生成排块', 'error')
      return
    }
    report = rematchLayout(layout, materials)
    renderer?.setLayout(layout, materials)
    refreshReport()
    await commitLayoutVersion(layout, 'Lab 色差重新匹配', true)
    await refreshHistory()
    toast('已使用 CIEDE2000 重新匹配', 'success')
  }

  async function restore(versionId: string, versionNumber: number): Promise<void> {
    try {
      layout = await restoreVersionById(versionId)
      report = buildMatchReport(layout, materials)
      paramPanel.sync(layout.params)
      selected = -1
      renderer?.setLayout(layout, materials)
      renderer?.setSelected(-1)
      refreshReport()
      refreshInspector()
      await commitLayoutVersion(layout, `恢复自 v${versionNumber}`, false)
      await refreshHistory()
      toast(`已恢复到 v${versionNumber}`, 'success')
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  container.replaceChildren(
    h('div', { class: 'grid' }, [
      h('div', { class: 'topbar', style: 'position:static;padding:0;border:0;background:none' }, [
        h('div', {}, [h('div', { class: 'crumb', text: '排块编辑 / 实例化 WebGL2' }), h('h1', { text: wall.name })]),
        h('div', { class: 'topbar-actions' }, [picker, h('a', { class: 'btn', attrs: { href: `#/preview?wall=${wall.id}` } }, '去光照预览')]),
      ]),
      h('div', { class: 'layout-editor' }, [
        paramPanel.element,
        h('section', { class: 'canvas-shell tall' }, [
          canvas,
          h('div', { class: 'canvas-status', style: 'left:16px;right:auto' }, [
            orbitButton,
            h('button', { class: 'btn sm', text: '重置视角', on: { click: () => renderer?.camera.fit(wall.widthM, wall.heightM, wall.shape === 'flat' ? 0.2 : wall.radiusM * 0.45) } }),
          ]),
          h('div', { class: 'canvas-status' }, [countPill, fpsPill, modePill]),
          h('div', { class: 'canvas-hint', html: '<span class="kbd">左键</span> 选块/拖动 · <span class="kbd">右键拖动</span> 旋转 · <span class="kbd">Shift+拖动</span> 平移 · 滚轮缩放' }),
        ]),
        h('aside', { class: 'grid right-panel' }, [
          h('div', { class: 'card compact' }, [h('div', { class: 'card-title', text: '单块检查器' }), inspectorHost]),
          h('div', { class: 'card compact' }, [h('div', { class: 'card-title' }, ['匹配与库存']), reportHost]),
          h('div', { class: 'card compact' }, [h('div', { class: 'card-title' }, ['版本历史', h('button', { class: 'btn sm btn-primary right', on: { click: () => saveVersion('手动检查点') } }, '保存当前版')]), historyHost]),
        ]),
      ]),
    ]),
  )

  try {
    renderer = new MosaicRenderer(canvas, wall)
    if (layout) renderer.setLayout(layout, materials)
    cleanupControls = attachEditorControls({
      canvas,
      renderer,
      wall,
      orbitMode: () => orbitMode,
      onPick: selectTile,
      onDrag: (index, x, y) => {
        if (!layout) return
        layout.positions[index * 2] = x
        layout.positions[index * 2 + 1] = y
        renderer?.uploadTileTransform(index)
      },
      onDragEnd: (index) => {
        void saveVersion(`移动块 #${index + 1}`)
      },
    })
  } catch (error) {
    console.error(error)
    canvas.replaceWith(h('div', { class: 'empty-state' }, [h('h2', { text: 'WebGL2 初始化失败' }), h('p', { text: (error as Error).message })]))
  }

  let fpsFrames = 0
  let fpsStart = performance.now()
  const fps = (now: number) => {
    if (destroyed) return
    fpsFrames++
    if (now - fpsStart >= 600) {
      fpsPill.textContent = `${Math.round(fpsFrames * 1000 / (now - fpsStart))} FPS`
      fpsFrames = 0
      fpsStart = now
    }
    fpsRaf = requestAnimationFrame(fps)
  }
  fpsRaf = requestAnimationFrame(fps)
  void refreshHistory()

  if (!savedLayout && materials.length > 0) {
    window.setTimeout(() => { if (!destroyed) void generate(false) }, 120)
  }

  return {
    destroy: () => {
      destroyed = true
      cancelAnimationFrame(fpsRaf)
      cleanupControls?.()
      renderer?.dispose()
    },
  }
}
