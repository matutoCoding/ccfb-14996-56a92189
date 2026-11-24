import { h, svgIcon, toast } from '../ui/dom'
import { numberField, selectField, textField } from '../ui/forms'
import { openModal } from '../ui/modal'
import {
  deleteProjectCascade,
  deleteWallCascade,
  listMaterials,
  listProjects,
  listWalls,
  saveProject,
  saveWall,
} from '../state/store'
import { wallArea } from '../core/geometry'
import type { Project, Wall, WallShape } from '../core/types'

const shapeLabel: Record<WallShape, string> = {
  flat: '平面墙',
  curved: '弧形墙',
  dome: '半穹顶',
}

function wallEditor(wall: Wall | null, projectId: string, onSaved: () => void): HTMLElement {
  const draft: Wall = wall ?? {
    id: crypto.randomUUID(),
    projectId,
    name: '',
    shape: 'flat',
    widthM: 4,
    heightM: 3,
    radiusM: 8,
    orientationDeg: 180,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  return h('div', { class: 'grid' }, [
    textField('墙面名称', draft.name, (v) => { draft.name = v }, { placeholder: '例如：中殿左侧墙' }),
    selectField<WallShape>('墙面形态', draft.shape, [
      { value: 'flat', label: '平面墙' },
      { value: 'curved', label: '弧形墙 / 圆柱面' },
      { value: 'dome', label: '教堂半穹顶' },
    ], (v) => { draft.shape = v }),
    h('div', { class: 'two-col-form' }, [
      numberField('墙宽 / 展开宽', draft.widthM, (v) => { draft.widthM = v }, { min: 0.5, max: 60, step: 0.01, unit: 'm' }),
      numberField('墙高 / 母线长', draft.heightM, (v) => { draft.heightM = v }, { min: 0.5, max: 30, step: 0.01, unit: 'm' }),
    ]),
    h('div', { class: 'two-col-form' }, [
      numberField('曲率半径', draft.radiusM, (v) => { draft.radiusM = v }, { min: 0, max: 100, step: 0.1, unit: 'm，0=自动' }),
      numberField('朝向方位角', draft.orientationDeg, (v) => { draft.orientationDeg = v }, { min: 0, max: 360, step: 1, unit: '°，180=正南' }),
    ]),
    h('div', { class: 'button-row mt-3' }, [
      h('button', {
        class: 'btn btn-primary',
        on: {
          click: async () => {
            if (!draft.name.trim()) {
              toast('先给墙面起个名字嘛~', 'error')
              return
            }
            if (draft.widthM <= 0 || draft.heightM <= 0) {
              toast('宽高必须大于 0', 'error')
              return
            }
            draft.updatedAt = Date.now()
            await saveWall(draft)
            toast('墙面参数已保存', 'success')
            onSaved()
          },
        },
      }, [svgIcon('check', 16), '保存墙面']),
    ]),
  ])
}

function projectEditor(project: Project | null, onSaved: () => void): HTMLElement {
  const draft: Project = project ?? {
    id: crypto.randomUUID(),
    name: '',
    client: '',
    location: '',
    note: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  return h('div', { class: 'grid' }, [
    textField('项目名称', draft.name, (v) => { draft.name = v }, { placeholder: '例如：圣马可教堂后殿' }),
    h('div', { class: 'two-col-form' }, [
      textField('客户 / 委托方', draft.client, (v) => { draft.client = v }),
      textField('地点', draft.location, (v) => { draft.location = v }),
    ]),
    textField('项目备注', draft.note, (v) => { draft.note = v }, { textarea: true }),
    h('button', {
      class: 'btn btn-primary',
      on: {
        click: async () => {
          if (!draft.name.trim()) {
            toast('项目名称不能为空', 'error')
            return
          }
          draft.updatedAt = Date.now()
          await saveProject(draft)
          toast('项目已存入 IndexedDB', 'success')
          onSaved()
        },
      },
    }, [svgIcon('check', 16), '保存项目']),
  ])
}

export async function renderProjects(container: HTMLElement): Promise<void> {
  const [projects, walls, materials] = await Promise.all([listProjects(), listWalls(), listMaterials()])
  const reload = () => { void renderProjects(container) }
  const totalArea = walls.reduce((sum, wall) => sum + wallArea(wall), 0)

  const openProjectModal = (project: Project | null) => {
    const modal = openModal(project ? '编辑项目' : '新建项目', projectEditor(project, () => { modal.close(); reload() }))
  }
  const openWallModal = (wall: Wall | null, projectId: string) => {
    const modal = openModal(wall ? '编辑墙面' : '新增墙面', wallEditor(wall, projectId, () => { modal.close(); reload() }))
  }

  container.replaceChildren(
    h('div', { class: 'grid' }, [
      h('div', { class: 'grid grid-4' }, [
        h('div', { class: 'stat' }, [h('div', { class: 'stat-value', text: String(projects.length) }), h('div', { class: 'stat-label', text: '项目' })]),
        h('div', { class: 'stat' }, [h('div', { class: 'stat-value', text: String(walls.length) }), h('div', { class: 'stat-label', text: '墙面 / 穹顶' })]),
        h('div', { class: 'stat' }, [h('div', { class: 'stat-value', text: `${totalArea.toFixed(1)} ㎡` }), h('div', { class: 'stat-label', text: '总面积' })]),
        h('div', { class: 'stat success' }, [h('div', { class: 'stat-value', text: String(materials.length) }), h('div', { class: 'stat-label', text: '材料颜色' })]),
      ]),

      h('div', { class: 'card' }, [
        h('div', { class: 'card-title' }, [
          svgIcon('projects', 20), '项目列表',
          h('button', { class: 'btn btn-primary right', on: { click: () => openProjectModal(null) } }, [svgIcon('plus', 16), '新建项目']),
        ]),
        projects.length === 0
          ? h('div', { class: 'empty-state' }, [
              h('div', { class: 'empty-icon' }, [svgIcon('projects', 28)]),
              h('h2', { text: '还没有项目' }),
              h('p', { text: '新建一个教堂或酒店壁画项目；人像、几何和半穹顶测试稿已随示例项目生成。' }),
            ])
          : h('div', { class: 'grid grid-2' }, projects.map((project) => {
              const projectWalls = walls.filter((wall) => wall.projectId === project.id)
              return h('article', { class: 'card project-card' }, [
                h('div', { class: 'project-head' }, [
                  h('div', { class: 'project-icon' }, [svgIcon('cube', 22)]),
                  h('div', {}, [
                    h('div', { class: 'project-name', text: project.name }),
                    h('div', { class: 'project-meta', text: [project.client, project.location].filter(Boolean).join(' · ') || '未填写客户信息' }),
                  ]),
                  h('div', { class: 'wall-actions' }, [
                    h('button', { class: 'btn btn-ghost sm', title: '编辑项目', on: { click: (e) => { e.stopPropagation(); openProjectModal(project) } } }, '编辑'),
                    h('button', {
                      class: 'btn btn-ghost sm',
                      on: {
                        click: async (e) => {
                          e.stopPropagation()
                          if (!confirm(`确认删除「${project.name}」及其所有墙面、排块和版本？`)) return
                          await deleteProjectCascade(project.id)
                          toast('项目已删除', 'info')
                          reload()
                        },
                      },
                    }, '删除'),
                  ]),
                ]),
                project.note ? h('p', { class: 'muted', text: project.note }) : null,
                h('div', { class: 'wall-list' }, projectWalls.length === 0
                  ? h('div', { class: 'muted', text: '这个项目还没有墙面。' })
                  : projectWalls.map((wall) => h('div', { class: 'wall-row' }, [
                      h('div', {}, [
                        h('strong', { text: wall.name }),
                        h('div', { class: 'meta', text: `${shapeLabel[wall.shape]} · ${wall.widthM}×${wall.heightM}m · ${wallArea(wall).toFixed(1)}㎡ · 朝${wall.orientationDeg}°` }),
                      ]),
                      h('div', { class: 'wall-actions' }, [
                        h('a', { class: 'btn sm', attrs: { href: `#/source?wall=${wall.id}` } }, '原稿'),
                        h('a', { class: 'btn sm btn-primary', attrs: { href: `#/editor?wall=${wall.id}` } }, '排块'),
                        h('a', { class: 'btn sm', attrs: { href: `#/preview?wall=${wall.id}` } }, '预览'),
                        h('a', { class: 'btn sm', attrs: { href: `#/drawings?wall=${wall.id}` } }, '施工图'),
                        h('button', { class: 'btn sm btn-ghost', on: { click: () => openWallModal(wall, project.id) } }, '设置'),
                        h('button', {
                          class: 'btn sm btn-ghost',
                          on: {
                            click: async () => {
                              if (!confirm(`删除墙面「${wall.name}」及其排块版本？`)) return
                              await deleteWallCascade(wall.id)
                              reload()
                            },
                          },
                        }, '删'),
                      ]),
                    ]))),
                h('div', {}, [
                  h('button', { class: 'btn sm', on: { click: () => openWallModal(null, project.id) } }, [svgIcon('plus', 14), '新增墙面']),
                ]),
              ])
            })),
      ]),
    ])
  )
}
