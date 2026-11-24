import { h, svgIcon, toast } from '../ui/dom'
import { numberField, selectField, textField } from '../ui/forms'
import { openModal } from '../ui/modal'
import { listMaterials, removeMaterial, saveMaterial } from '../state/store'
import type { Material, MaterialCategory } from '../core/types'

const categoryLabel: Record<MaterialCategory, string> = {
  glass: '手工熔制玻璃',
  gold: '金箔块',
  stone: '天然石材',
}

function materialEditor(material: Material | null, all: Material[], onSaved: () => void): HTMLElement {
  const draft: Material = material ?? {
    id: crypto.randomUUID(),
    numericCode: Math.max(0, ...all.map((m) => m.numericCode)) + 1,
    code: '',
    name: '',
    category: 'glass',
    hex: '#4f9d91',
    opacity: 0.86,
    roughness: 0.16,
    reflectivity: 0.72,
    relief: 0.22,
    metalness: 0,
    stock: 1000,
    safetyStock: 500,
  }
  if (!material) draft.code = `C${draft.numericCode}`
  const preview = h('div', { class: `material-preview ${draft.category}`, style: `background:${draft.hex}` })

  return h('div', { class: 'grid' }, [
    h('div', { class: 'two-col-form' }, [
      textField('颜色编号', draft.code, (v) => { draft.code = v }),
      textField('材料名称', draft.name, (v) => { draft.name = v }, { placeholder: '例如：孔雀蓝玻璃' }),
    ]),
    h('div', { class: 'two-col-form' }, [
      selectField<MaterialCategory>('分类', draft.category, [
        { value: 'glass', label: categoryLabel.glass },
        { value: 'gold', label: categoryLabel.gold },
        { value: 'stone', label: categoryLabel.stone },
      ], (v) => {
        draft.category = v
        draft.metalness = v === 'gold' ? 1 : 0
        draft.opacity = v === 'glass' ? draft.opacity : 1
        preview.className = `material-preview ${v}`
      }),
      h('label', { class: 'field' }, [
        h('span', { text: '基础颜色' }),
        h('input', {
          attrs: { type: 'color' },
          props: { value: draft.hex },
          on: { input: (e) => { draft.hex = (e.target as HTMLInputElement).value; preview.style.background = draft.hex } },
        }),
      ]),
    ]),
    preview,
    h('div', { class: 'two-col-form' }, [
      numberField('不透明度', draft.opacity, (v) => { draft.opacity = Math.min(1, Math.max(0.05, v)) }, { min: 0.05, max: 1, step: 0.01 }),
      numberField('粗糙度', draft.roughness, (v) => { draft.roughness = Math.min(1, Math.max(0.02, v)) }, { min: 0.02, max: 1, step: 0.01 }),
      numberField('反光参数', draft.reflectivity, (v) => { draft.reflectivity = Math.min(1, Math.max(0, v)) }, { min: 0, max: 1, step: 0.01 }),
      numberField('表面起伏', draft.relief, (v) => { draft.relief = Math.min(1, Math.max(0, v)) }, { min: 0, max: 1, step: 0.01 }),
      numberField('库存数量', draft.stock, (v) => { draft.stock = Math.max(0, Math.round(v)) }, { min: 0, step: 10 }),
      numberField('安全库存', draft.safetyStock, (v) => { draft.safetyStock = Math.max(0, Math.round(v)) }, { min: 0, step: 10 }),
    ]),
    h('button', {
      class: 'btn btn-primary',
      on: {
        click: async () => {
          if (!draft.name.trim() || !draft.code.trim()) {
            toast('编号和名称都要填', 'error')
            return
          }
          await saveMaterial(draft)
          toast('材料已保存', 'success')
          onSaved()
        },
      },
    }, '保存材料'),
  ])
}

export async function renderMaterials(container: HTMLElement): Promise<void> {
  let materials = await listMaterials()
  let filter: MaterialCategory | 'all' = 'all'

  const draw = () => {
    const filtered = materials.filter((m) => filter === 'all' || m.category === filter)
    const lowStock = materials.filter((m) => m.stock < m.safetyStock).length
    const totalStock = materials.reduce((sum, m) => sum + m.stock, 0)

    const openEditor = (material: Material | null) => {
      const modal = openModal(material ? `编辑 ${material.code}` : '新增材料', materialEditor(material, materials, () => {
        modal.close()
        void listMaterials().then((items) => { materials = items; draw() })
      }))
    }

    container.replaceChildren(
      h('div', { class: 'grid' }, [
        h('div', { class: 'grid grid-4' }, [
          h('div', { class: 'stat' }, [h('div', { class: 'stat-value', text: String(materials.length) }), h('div', { class: 'stat-label', text: '材料颜色' })]),
          h('div', { class: 'stat success' }, [h('div', { class: 'stat-value', text: totalStock.toLocaleString() }), h('div', { class: 'stat-label', text: '库存总块数' })]),
          h('div', { class: `stat ${lowStock ? 'danger' : ''}` }, [h('div', { class: 'stat-value', text: String(lowStock) }), h('div', { class: 'stat-label', text: '低于安全库存' })]),
          h('div', { class: 'stat' }, [h('div', { class: 'stat-value', text: 'Lab' }), h('div', { class: 'stat-label', text: '色差匹配：CIEDE2000' })]),
        ]),
        h('div', { class: 'card' }, [
          h('div', { class: 'card-title' }, [
            svgIcon('materials', 20), '材料库',
            h('div', { class: 'button-row right' }, [
              ...(['all', 'glass', 'gold', 'stone'] as const).map((key) => h('button', {
                class: `btn sm ${filter === key ? 'btn-dark' : ''}`,
                on: { click: () => { filter = key; draw() } },
                text: key === 'all' ? '全部' : categoryLabel[key],
              })),
              h('button', { class: 'btn btn-primary sm', on: { click: () => openEditor(null) } }, [svgIcon('plus', 14), '新增']),
            ]),
          ]),
          h('div', { class: 'material-grid' }, filtered.map((material) => h('article', { class: 'card compact material-card' }, [
            h('div', {
              class: `material-preview ${material.category}`,
              style: `background-color:${material.hex}`,
            }),
            h('div', {}, [
              h('div', { class: 'row', style: 'display:flex;gap:8px;align-items:center' }, [
                h('span', { class: 'code-pill badge primary', text: material.code }),
                h('span', { class: 'badge', text: categoryLabel[material.category] }),
              ]),
              h('h3', { class: 'mt-2', style: 'font-size:16px;font-weight:600', text: material.name }),
            ]),
            h('div', { class: 'material-props' }, [
              h('span', { text: `透明度 ${material.opacity.toFixed(2)}` }),
              h('span', { text: `粗糙度 ${material.roughness.toFixed(2)}` }),
              h('span', { text: `反光 ${material.reflectivity.toFixed(2)}` }),
              h('span', { text: `起伏 ${material.relief.toFixed(2)}` }),
            ]),
            h('label', { class: 'field' }, [
              h('span', { text: '库存（块）' }),
              h('input', {
                class: 'input',
                attrs: { type: 'number', min: 0 },
                props: { value: String(material.stock) },
                on: {
                  change: async (event) => {
                    material.stock = Math.max(0, Math.round(Number((event.target as HTMLInputElement).value)))
                    await saveMaterial(material)
                    toast(`${material.code} 库存已更新`, 'success')
                    materials = await listMaterials()
                  },
                },
              }),
            ]),
            h('div', { class: 'button-row' }, [
              h('button', { class: 'btn sm', on: { click: () => openEditor(material) } }, '编辑参数'),
              h('button', {
                class: 'btn sm btn-ghost',
                on: {
                  click: async () => {
                    if (!confirm(`删除材料 ${material.code}？已有排块会显示为缺色。`)) return
                    await removeMaterial(material.id)
                    materials = await listMaterials()
                    draw()
                  },
                },
              }, '删除'),
              material.stock < material.safetyStock ? h('span', { class: 'badge danger right' }, '库存不足') : h('span', { class: 'badge success right' }, '库存正常'),
            ]),
          ]))),
        ]),
      ])
    )
  }

  draw()
}
