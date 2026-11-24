import { h, svgIcon } from '../ui/dom'
import { rangeField } from '../ui/forms'
import type { LayoutData, Material } from '../core/types'

export interface InspectorOptions {
  layout: LayoutData
  index: number
  materials: Material[]
  onMaterialChange: () => void
  onCustomColor: (hex: string) => void
  onTransformChange: () => void
  onSaveVersion: () => void
}

export function renderInspector(options: InspectorOptions): HTMLElement {
  const { layout, index, materials } = options
  const code = layout.materialCodes[index]
  const material = materials.find((item) => item.numericCode === code)
  const angleDeg = layout.angles[index] * 180 / Math.PI
  const tiltXDeg = layout.tilts[index * 2] * 180 / Math.PI
  const tiltYDeg = layout.tilts[index * 2 + 1] * 180 / Math.PI

  const angle = rangeField('平面旋转角', angleDeg, -180, 180, 0.5, (value) => {
    layout.angles[index] = value * Math.PI / 180
    options.onTransformChange()
  }, (v) => `${v.toFixed(1)}°`)

  const tiltX = rangeField('左右倾角', tiltXDeg, -25, 25, 0.5, (value) => {
    layout.tilts[index * 2] = value * Math.PI / 180
    options.onTransformChange()
  }, (v) => `${v.toFixed(1)}°`)

  const tiltY = rangeField('上下倾角', tiltYDeg, -25, 25, 0.5, (value) => {
    layout.tilts[index * 2 + 1] = value * Math.PI / 180
    options.onTransformChange()
  }, (v) => `${v.toFixed(1)}°`)

  return h('div', { class: 'grid' }, [
    h('div', { class: 'wall-row' }, [
      h('span', { class: 'swatch', style: `background:${material?.hex ?? '#f0f'}` }),
      h('div', {}, [
        h('strong', { class: 'code-pill', text: `#${index + 1} · ${material?.code ?? code}` }),
        h('div', { class: 'meta', text: material?.name ?? '材料已删除' }),
      ]),
    ]),
    h('label', { class: 'field' }, [
      h('span', { text: '改颜色 / 指定材料' }),
      h('select', {
        class: 'select',
        on: {
          change: (event) => {
            layout.materialCodes[index] = Number((event.target as HTMLSelectElement).value)
            options.onMaterialChange()
          },
        },
      }, materials.map((item) => h('option', {
        text: `${item.code} · ${item.name}`,
        attrs: { value: String(item.numericCode), selected: item.numericCode === code },
      }))),
    ]),
    h('label', { class: 'field' }, [
      h('span', { text: '任意颜色（自动建自定义色号）' }),
      h('input', {
        attrs: { type: 'color' },
        props: { value: material?.hex ?? '#808080' },
        on: { change: (event) => options.onCustomColor((event.target as HTMLInputElement).value) },
      }),
    ]),
    angle,
    tiltX,
    tiltY,
    h('div', { class: 'material-props' }, [
      h('span', { text: `X ${layout.positions[index * 2].toFixed(3)}m` }),
      h('span', { text: `Y ${layout.positions[index * 2 + 1].toFixed(3)}m` }),
      h('span', { text: `宽 ${(layout.sizes[index * 2] * 1000).toFixed(1)}mm` }),
      h('span', { text: `高 ${(layout.sizes[index * 2 + 1] * 1000).toFixed(1)}mm` }),
    ]),
    h('button', { class: 'btn btn-primary', on: { click: options.onSaveVersion } }, [svgIcon('save', 15), '保存为新版本']),
  ])
}
