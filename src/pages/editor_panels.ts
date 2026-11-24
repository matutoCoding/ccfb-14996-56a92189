import { h, svgIcon, formatNumber } from '../ui/dom'
import { formatDateTime } from '../state/store'
import type { MatchReport, Material, LayoutVersion } from '../core/types'

export function reportPanel(report: MatchReport | null, materials: Material[]): HTMLElement {
  if (!report) {
    return h('div', { class: 'empty-state', style: 'min-height:180px' }, [
      h('div', { class: 'empty-icon' }, [svgIcon('materials', 24)]),
      h('h3', { style: 'font-size:18px', text: '尚未匹配材料' }),
      h('p', { text: '生成排块后，会按每块原稿颜色在 Lab 空间执行 CIEDE2000 匹配。' }),
    ])
  }

  const materialName = new Map(materials.map((m) => [m.numericCode, m]))
  return h('div', { class: 'grid' }, [
    h('div', { class: 'grid grid-2' }, [
      h('div', { class: `stat compact ${report.tooManyColors ? 'warning' : 'success'}` }, [
        h('div', { class: 'stat-value', style: 'font-size:22px', text: `${report.usedColorCount}/${report.maxColors}` }),
        h('div', { class: 'stat-label', text: '使用颜色 / 上限' }),
      ]),
      h('div', { class: `stat compact ${report.shortagePieces ? 'danger' : 'success'}` }, [
        h('div', { class: 'stat-value', style: 'font-size:22px', text: formatNumber(report.shortagePieces) }),
        h('div', { class: 'stat-label', text: '库存缺口（块）' }),
      ]),
    ]),
    report.tooManyColors
      ? h('div', { class: 'warning-panel' }, [
          h('strong', { text: `用色过多：${report.usedColorCount} 种` }),
          h('span', { text: `超过设定的 ${report.maxColors} 种上限。可提高块径、降低原稿对比度，或在材料库合并近似色。` }),
        ])
      : h('div', { class: 'success-panel' }, `颜色数量在 ${report.maxColors} 种控制目标内。`),
    report.shortagePieces > 0
      ? h('div', { class: 'danger-panel' }, [
          h('strong', { text: `${report.shortageCount} 种材料库存不足` }),
          h('span', { text: '下表红色数量为含损耗后的缺口；施工图材料汇总也会同步。' }),
        ])
      : h('div', { class: 'success-panel' }, '按当前损耗率计算，库存足够。'),
    h('div', { class: 'table-wrap', style: 'max-height:280px' }, [
      h('table', { class: 'data' }, [
        h('thead', {}, [h('tr', {}, ['颜色', '编号', '用量', '需求', '库存', '缺口'].map((text) => h('th', { text })))]),
        h('tbody', {}, report.usages.slice(0, 12).map((usage) => {
          const material = materialName.get(usage.material.numericCode) ?? usage.material
          return h('tr', {}, [
            h('td', {}, [h('span', { class: 'swatch', style: `display:inline-block;background:${material.hex}` })]),
            h('td', { class: 'code-pill', text: material.code }),
            h('td', { text: formatNumber(usage.count) }),
            h('td', { text: formatNumber(usage.requiredWithWaste) }),
            h('td', { text: formatNumber(usage.stock) }),
            h('td', {}, [usage.shortage > 0 ? h('span', { class: 'badge danger', text: formatNumber(usage.shortage) }) : h('span', { class: 'badge success', text: '够' })]),
          ])
        })),
      ]),
    ]),
  ])
}

export function historyList(
  versions: LayoutVersion[],
  onRestore: (version: LayoutVersion) => void,
): HTMLElement {
  if (versions.length === 0) {
    return h('div', { class: 'muted', text: '还没有历史版本。生成排块或保存修改后会出现在这里。' })
  }
  return h('div', { class: 'history-list' }, versions.map((version, index) => h('div', { class: `history-item ${index === 0 ? 'current' : ''}` }, [
    h('div', { class: 'row' }, [
      h('strong', { text: `v${version.version} · ${version.label}` }),
      index === 0 ? h('span', { class: 'badge primary', text: '最新' }) : null,
      version.auto ? h('span', { class: 'badge', text: '自动' }) : h('span', { class: 'badge success', text: '检查点' }),
    ]),
    h('time', { text: formatDateTime(version.createdAt) }),
    h('div', { class: 'row' }, [
      h('span', { class: 'muted', text: `${formatNumber(version.count)} 块` }),
      h('button', {
        class: 'btn sm right',
        on: { click: () => onRestore(version) },
      }, '恢复此版'),
    ]),
  ])))
}

export function inspectorEmpty(): HTMLElement {
  return h('div', { class: 'empty-state', style: 'min-height:180px' }, [
    h('div', { class: 'empty-icon' }, [svgIcon('editor', 24)]),
    h('h3', { style: 'font-size:18px', text: '点选或拖动一块' }),
    h('p', { text: '左键点块可改材料、平面角和三维倾角；右键拖动旋转，滚轮缩放。' }),
  ])
}
