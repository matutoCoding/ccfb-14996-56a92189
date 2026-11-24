import { h, svgIcon, toast } from '../ui/dom'
import { rangeField } from '../ui/forms'
import { wallPicker } from '../ui/wall_context'
import { getSourceForWall, getWall, saveSource } from '../state/store'
import { analyzeGuides, rasterizeSource } from '../core/guides'
import { createDomeDataUrl, createGeometricDataUrl, createPortraitDataUrl } from '../core/samples'
import type { GuideField, SourceRecord, Wall } from '../core/types'

async function fileToDataUrl(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.width, height: img.height })
    img.onerror = () => reject(new Error('图片读取失败'))
    img.src = dataUrl
  })
  return { dataUrl, ...size }
}

function drawGuideOverlay(canvas: HTMLCanvasElement, guide: GuideField): void {
  canvas.width = guide.cols
  canvas.height = guide.rows
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const colors = {
    contour: 'rgba(255, 92, 71, .82)',
    flow: 'rgba(64, 224, 255, .62)',
    face: 'rgba(255, 214, 92, .9)',
  } as const

  for (const line of guide.lines) {
    if (line.points.length < 2) continue
    ctx.beginPath()
    line.points.forEach((point, index) => {
      const x = point.x * guide.cols
      const y = point.y * guide.rows
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = colors[line.kind]
    ctx.lineWidth = line.kind === 'face' ? 2.2 : 1.25
    ctx.stroke()
  }
}

export async function renderSource(container: HTMLElement, query: URLSearchParams): Promise<{ destroy: () => void }> {
  const wallId = query.get('wall') ?? undefined
  const picker = await wallPicker(wallId, '#/source')
  if (!wallId) {
    container.replaceChildren(h('div', { class: 'card' }, [picker, h('div', { class: 'empty-state' }, [
      h('div', { class: 'empty-icon' }, [svgIcon('source', 28)]),
      h('h2', { text: '先选择一面墙' }),
      h('p', { text: '原稿会按墙面宽高比做 cover 裁切，并生成轮廓、衣褶与人脸走向引导线。' }),
    ])]))
    return { destroy: () => undefined }
  }

  const loadedWall = await getWall(wallId)
  if (!loadedWall) {
    container.replaceChildren(h('div', { class: 'card empty-state' }, ['墙面不存在，请从项目列表重新选择。']))
    return { destroy: () => undefined }
  }
  const wall: Wall = loadedWall

  let source = await getSourceForWall(wallId)
  let guide: GuideField | null = null
  let refreshToken = 0
  let debounce = 0

  const canvasHost = h('div', { class: 'source-wrap' })
  const status = h('span', { class: 'badge primary', text: '正在分析原稿…' })

  const scheduleRefresh = () => {
    window.clearTimeout(debounce)
    debounce = window.setTimeout(refresh, 140)
  }

  async function refresh(): Promise<void> {
    if (!source) return
    const token = ++refreshToken
    status.textContent = '正在生成引导线…'
    try {
      const imageData = await rasterizeSource(source!, wall!, 640)
      if (token !== refreshToken) return
      const base = h('canvas', { attrs: { width: imageData.width, height: imageData.height } }) as HTMLCanvasElement
      const ctx = base.getContext('2d')
      ctx?.putImageData(imageData, 0, 0)
      guide = analyzeGuides(imageData, {
        edgeSensitivity: source.edgeSensitivity,
        guideDensity: source.guideDensity,
        faceFlow: source.faceFlow,
      })
      const overlay = h('canvas', { class: 'guide-overlay' }) as HTMLCanvasElement
      drawGuideOverlay(overlay, guide)
      canvasHost.replaceChildren(base, overlay)
      status.textContent = `${guide.lines.length} 条引导线`
      status.className = 'badge success'
    } catch (error) {
      status.textContent = '原稿分析失败'
      status.className = 'badge danger'
      toast((error as Error).message, 'error')
    }
  }

  const uploadInput = h('input', {
    attrs: { type: 'file', accept: 'image/*' },
    style: 'display:none',
    on: {
      change: async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0]
        if (!file) return
        const image = await fileToDataUrl(file)
        source = {
          id: source?.id ?? `src_${wall.id}`,
          wallId: wall.id,
          name: file.name,
          dataUrl: image.dataUrl,
          width: image.width,
          height: image.height,
          brightness: source?.brightness ?? 100,
          contrast: source?.contrast ?? 110,
          edgeSensitivity: source?.edgeSensitivity ?? 0.58,
          guideDensity: source?.guideDensity ?? 0.62,
          faceFlow: source?.faceFlow ?? 0.82,
          updatedAt: Date.now(),
        }
        await saveSource(source)
        toast('原稿已导入 IndexedDB', 'success')
        drawPage()
        void refresh()
      },
    },
  }) as HTMLInputElement

  const useSample = async (kind: 'portrait' | 'geo' | 'dome') => {
    const dataUrl = kind === 'portrait' ? createPortraitDataUrl() : kind === 'geo' ? createGeometricDataUrl() : createDomeDataUrl()
    source = {
      id: source?.id ?? `src_${wall.id}`,
      wallId: wall.id,
      name: kind === 'portrait' ? '生成式人像原稿' : kind === 'geo' ? '生成式几何原稿' : '生成式半穹顶原稿',
      dataUrl,
      width: kind === 'dome' ? 1200 : kind === 'geo' ? 1000 : 800,
      height: kind === 'dome' ? 640 : kind === 'geo' ? 1000 : 1000,
      brightness: 100,
      contrast: 110,
      edgeSensitivity: 0.58,
      guideDensity: 0.62,
      faceFlow: kind === 'portrait' ? 0.85 : 0.25,
      updatedAt: Date.now(),
    }
    await saveSource(source)
    drawPage()
    void refresh()
  }

  function drawPage(): void {
    if (!source) {
      container.replaceChildren(
        h('div', { class: 'grid' }, [
          h('div', { class: 'card' }, [picker]),
          h('div', { class: 'card empty-state' }, [
            h('div', { class: 'empty-icon' }, [svgIcon('source', 28)]),
            h('h2', { text: '这面墙还没有原稿' }),
            h('p', { text: '导入 PS 稿、照片或扫描稿；也可以直接载入内置人像、几何或半穹顶测试图。' }),
            h('div', { class: 'button-row' }, [
              h('button', { class: 'btn btn-primary', on: { click: () => uploadInput.click() } }, [svgIcon('source', 16), '导入原稿']),
              h('button', { class: 'btn', on: { click: () => useSample('portrait') } }, '人像样稿'),
              h('button', { class: 'btn', on: { click: () => useSample('geo') } }, '几何样稿'),
              h('button', { class: 'btn', on: { click: () => useSample('dome') } }, '半穹顶样稿'),
            ]),
            uploadInput,
          ]),
        ]),
      )
      return
    }

    container.replaceChildren(
      h('div', { class: 'grid' }, [
        h('div', { class: 'topbar', style: 'position:static;padding:0;border:0;background:none' }, [
          h('div', {}, [h('div', { class: 'crumb', text: '原稿处理 / 引导线' }), h('h1', { text: wall.name })]),
          h('div', { class: 'topbar-actions' }, [picker, status]),
        ]),
        h('div', { class: 'layout-preview' }, [
          h('aside', { class: 'card' }, [
            h('div', { class: 'card-title' }, [svgIcon('source', 19), '原稿与引导']),
            h('div', { class: 'button-row' }, [
              h('button', { class: 'btn btn-primary', on: { click: () => uploadInput.click() } }, '替换原稿'),
              h('button', { class: 'btn', on: { click: () => refresh() } }, [svgIcon('reset', 15), '重新分析']),
            ]),
            uploadInput,
            h('div', { class: 'section-label', text: '画面调整' }),
            rangeField('亮度', source.brightness, 60, 140, 1, (v) => { source!.brightness = v; scheduleRefresh() }, (v) => `${v}%`),
            rangeField('对比度', source.contrast, 70, 160, 1, (v) => { source!.contrast = v; scheduleRefresh() }, (v) => `${v}%`),
            h('div', { class: 'section-label', text: '引导线算法' }),
            rangeField('轮廓敏感度', source.edgeSensitivity, 0.1, 1, 0.01, (v) => { source!.edgeSensitivity = v; scheduleRefresh() }, (v) => v.toFixed(2)),
            rangeField('引导线密度', source.guideDensity, 0.15, 1, 0.01, (v) => { source!.guideDensity = v; scheduleRefresh() }, (v) => v.toFixed(2)),
            rangeField('人脸 / 主体走向权重', source.faceFlow, 0, 1, 0.01, (v) => { source!.faceFlow = v; scheduleRefresh() }, (v) => v.toFixed(2)),
            h('div', { class: 'warning-panel mt-4' }, [
              h('strong', { text: '走向规则' }),
              h('span', { text: 'Sobel 梯度旋转 90° 得到轮廓切线，再用双向角平滑；肤色椭圆区域会强制沿脸部椭圆走，衣褶由强切线捕捉。' }),
            ]),
            h('div', { class: 'button-row mt-4' }, [
              h('button', {
                class: 'btn',
                on: {
                  click: async () => {
                    await saveSource(source!)
                    toast('原稿参数已保存', 'success')
                  },
                },
              }, [svgIcon('save', 15), '保存参数']),
              h('button', {
                class: 'btn btn-primary right',
                on: {
                  click: async () => {
                    await saveSource(source!)
                    location.hash = `#/editor?wall=${wall.id}`
                  },
                },
              }, '去排块'),
            ]),
          ]),
          h('section', { class: 'source-stage' }, [
            (() => {
              const aspect = wall.widthM / wall.heightM
              canvasHost.style.aspectRatio = `${wall.widthM} / ${wall.heightM}`
              if (aspect >= 1) canvasHost.style.width = 'min(100%, 1080px)'
              else canvasHost.style.height = '76vh'
              return canvasHost
            })(),
          ]),
        ]),
      ]),
    )
    void refresh()
  }

  drawPage()
  return { destroy: () => window.clearTimeout(debounce) }
}
