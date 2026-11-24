import { downloadText, formatNumber, h, svgIcon, toast } from '../ui/dom'
import { wallPicker } from '../ui/wall_context'
import { getProject, getLayout, getWall, listMaterials } from '../state/store'
import { buildMatchReport } from '../core/materials'
import { bomCsv, renderSheetCanvas } from '../core/drawing'
import { getMeterSheets } from '../core/geometry'

const categoryName = { glass: '玻璃', gold: '金箔', stone: '石材' } as const

export async function renderDrawings(container: HTMLElement, query: URLSearchParams): Promise<{ destroy: () => void }> {
  const wallId = query.get('wall') ?? undefined
  const picker = await wallPicker(wallId, '#/drawings')
  if (!wallId) {
    container.replaceChildren(h('div', { class: 'card' }, [picker, h('div', { class: 'empty-state' }, ['请先选择一面墙。'])]))
    return { destroy: () => undefined }
  }

  const [loadedWall, loadedLayout, materials] = await Promise.all([getWall(wallId), getLayout(wallId), listMaterials()])
  if (!loadedWall) {
    container.replaceChildren(h('div', { class: 'card empty-state' }, ['墙面不存在。']))
    return { destroy: () => undefined }
  }
  if (!loadedLayout || loadedLayout.count === 0) {
    container.replaceChildren(h('div', { class: 'grid' }, [
      h('div', { class: 'card' }, [picker]),
      h('div', { class: 'card empty-state' }, [
        h('div', { class: 'empty-icon' }, [svgIcon('drawing', 30)]),
        h('h2', { text: '还没有可出图的排块' }),
        h('p', { text: '先生成排块并完成 Lab 配色，再按平方米分格输出带颜色编号的施工图。' }),
        h('a', { class: 'btn btn-primary', attrs: { href: `#/editor?wall=${loadedWall.id}` } }, '去排块编辑'),
      ]),
    ]))
    return { destroy: () => undefined }
  }
  const wall = loadedWall
  const layout = loadedLayout

  const project = await getProject(wall.projectId)
  const sheets = getMeterSheets(wall)
  const report = buildMatchReport(layout, materials)
  let selectedIndex = Math.max(0, Math.min(0, sheets.length - 1))
  const canvasHost = h('div', { class: 'drawing-canvas-wrap' })
  const sheetGrid = h('div', { class: 'sheet-grid' })
  const printHost = h('div', { id: 'print-all-host', class: 'print-only' })

  function drawSheet(index: number): void {
    selectedIndex = index
    const sheet = sheets[index]
    sheetGrid.querySelectorAll('.sheet-tile').forEach((node, i) => node.classList.toggle('active', i === index))
    canvasHost.replaceChildren()
    try {
      const canvas = renderSheetCanvas({ wall, layout: layout!, materials, sheet, pixelsPerM: 1750 })
      canvas.style.width = '100%'
      canvas.style.maxWidth = '980px'
      canvasHost.append(canvas)
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }

  function drawSheetButtons(): void {
    sheetGrid.replaceChildren(...sheets.map((sheet, index) => h('button', {
      class: `sheet-tile ${index === selectedIndex ? 'active' : ''}`,
      on: { click: () => drawSheet(index) },
    }, [
      h('strong', { style: 'font-size:18px', text: sheet.label }),
      h('span', { class: 'muted', text: `列 ${sheet.col + 1} / 行 ${sheet.row + 1}` }),
      h('span', { class: 'badge', text: `${sheet.area.toFixed(2)}㎡` }),
    ])))
  }

  async function printAll(): Promise<void> {
    printHost.replaceChildren()
    toast(`正在生成 ${sheets.length} 张分格图…`, 'info')
    await new Promise((resolve) => setTimeout(resolve, 30))
    for (const sheet of sheets) {
      const canvas = renderSheetCanvas({ wall, layout: layout!, materials, sheet, pixelsPerM: 1350 })
      const image = h('img', { attrs: { src: canvas.toDataURL('image/png'), alt: sheet.label } })
      printHost.append(h('section', { class: 'drawing-page' }, [
        h('div', { class: 'drawing-header' }, [
          h('div', {}, [
            h('strong', { style: 'font-size:18px', text: project?.name ?? '马赛克壁画工程' }),
            h('div', { text: `${wall.name} · 施工图分格 ${sheet.label}` }),
          ]),
          h('div', { class: 'muted', text: `1m 网格 · ${new Date().toLocaleDateString('zh-CN')}` }),
        ]),
        image,
        h('div', { class: 'drawing-meta' }, [
          h('div', { text: `墙面尺寸：${wall.widthM} × ${wall.heightM} m` }),
          h('div', { text: `本格范围：X ${sheet.x0}-${sheet.x1}m / Y ${sheet.y0}-${sheet.y1}m` }),
          h('div', { text: `缝宽：${layout!.params.gapMm} mm` }),
          h('div', { text: `总块数：${formatNumber(layout!.count)}` }),
        ]),
      ]))
    }
    document.body.append(printHost)
    document.body.classList.add('printing-all')
    const cleanup = () => {
      document.body.classList.remove('printing-all')
      printHost.remove()
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
  }

  drawSheetButtons()

  container.replaceChildren(
    h('div', { class: 'grid' }, [
      h('div', { class: 'topbar no-print', style: 'position:static;padding:0;border:0;background:none' }, [
        h('div', {}, [h('div', { class: 'crumb', text: '施工图 / 平方米分格 / BOM' }), h('h1', { text: wall.name })]),
        h('div', { class: 'topbar-actions' }, [picker]),
      ]),
      h('div', { class: 'grid grid-4 no-print' }, [
        h('div', { class: 'stat' }, [h('div', { class: 'stat-value', text: String(sheets.length) }), h('div', { class: 'stat-label', text: '平方米分格' })]),
        h('div', { class: 'stat' }, [h('div', { class: 'stat-value', text: formatNumber(layout.count) }), h('div', { class: 'stat-label', text: '总块数' })]),
        h('div', { class: 'stat warning' }, [h('div', { class: 'stat-value', text: String(report.usedColorCount) }), h('div', { class: 'stat-label', text: '汇总颜色编号' })]),
        h('div', { class: `stat ${report.shortagePieces ? 'danger' : 'success'}` }, [h('div', { class: 'stat-value', text: formatNumber(report.shortagePieces) }), h('div', { class: 'stat-label', text: '材料缺口' })]),
      ]),
      h('div', { class: 'layout-preview' }, [
        h('aside', { class: 'card no-print' }, [
          h('div', { class: 'card-title' }, ['选择分格']),
          sheetGrid,
          h('div', { class: 'button-row mt-4' }, [
            h('button', { class: 'btn btn-primary', on: { click: () => window.print() } }, [svgIcon('print', 16), '打印本张']),
            h('button', { class: 'btn', on: { click: () => void printAll() } }, '打印全部分格'),
            h('button', {
              class: 'btn',
              on: {
                click: () => downloadText(
                  `${wall.name}-材料清单.csv`,
                  bomCsv(report.usages.map((u) => ({
                    code: u.material.code,
                    name: u.material.name,
                    category: categoryName[u.material.category],
                    count: u.count,
                    requiredWithWaste: u.requiredWithWaste,
                    stock: u.stock,
                    shortage: u.shortage,
                  }))),
                  'text/csv',
                ),
              },
            }, '导出 BOM CSV'),
          ]),
          h('div', { class: 'warning-panel mt-4' }, [
            h('strong', { text: '出图说明' }),
            h('span', { text: '每格按真实米制坐标绘制，块内编号为材料颜色编号；黑点表示该块三维倾角超过 4°，铺贴时需加垫片。' }),
          ]),
        ]),
        h('section', { class: 'drawing-page screen-drawing' }, [
          h('div', { class: 'drawing-header' }, [
            h('div', {}, [
              h('strong', { style: 'font-size:20px', text: project?.name ?? '马赛克壁画工程' }),
              h('div', { text: `${wall.name} · 颜色编号排块施工图` }),
            ]),
            h('div', { class: 'muted', text: `每平方米分格 · ${new Date().toLocaleDateString('zh-CN')}` }),
          ]),
          canvasHost,
          h('div', { class: 'drawing-meta' }, [
            h('div', { text: `墙面：${wall.widthM} × ${wall.heightM} m（${wall.shape}）` }),
            h('div', { text: `缝宽：${layout.params.gapMm} mm` }),
            h('div', { text: `标称块径：${layout.params.tileSizeMm} mm` }),
            h('div', { text: `种子：${layout.params.seed}` }),
          ]),
        ]),
      ]),
      h('section', { class: 'card no-print' }, [
        h('div', { class: 'card-title' }, [svgIcon('drawing', 19), '材料清单 / 按颜色汇总']),
        h('div', { class: 'table-wrap' }, [
          h('table', { class: 'data' }, [
            h('thead', {}, [h('tr', {}, ['颜色', '编号', '名称', '分类', '净用量', `含${layout.params.wastePercent}%损耗`, '库存', '缺口'].map((x) => h('th', { text: x })))]),
            h('tbody', {}, report.usages.map((usage) => h('tr', {}, [
              h('td', {}, [h('span', { class: 'swatch', style: `display:inline-block;background:${usage.material.hex}` })]),
              h('td', { class: 'code-pill', text: usage.material.code }),
              h('td', { text: usage.material.name }),
              h('td', { text: categoryName[usage.material.category] }),
              h('td', { text: formatNumber(usage.count) }),
              h('td', { text: formatNumber(usage.requiredWithWaste) }),
              h('td', { text: formatNumber(usage.stock) }),
              h('td', {}, [usage.shortage > 0 ? h('span', { class: 'badge danger', text: formatNumber(usage.shortage) }) : h('span', { class: 'badge success', text: '无缺口' })]),
            ]))),
          ]),
        ]),
      ]),
    ]),
  )

  drawSheet(0)
  return { destroy: () => undefined }
}
