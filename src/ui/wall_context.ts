import { h } from './dom'
import { listProjects, listWalls } from '../state/store'

export async function wallPicker(currentWallId: string | undefined, baseHash: string): Promise<HTMLElement> {
  const [walls, projects] = await Promise.all([listWalls(), listProjects()])
  const projectName = new Map(projects.map((p) => [p.id, p.name]))
  const grouped = new Map<string, typeof walls>()
  for (const wall of walls) {
    const list = grouped.get(wall.projectId) ?? []
    list.push(wall)
    grouped.set(wall.projectId, list)
  }

  const select = h('select', {
    class: 'select',
    attrs: { 'aria-label': '选择墙面' },
    on: {
      change: (event) => {
        const id = (event.target as HTMLSelectElement).value
        location.hash = `${baseHash}?wall=${id}`
      },
    },
  }, [
    h('option', { text: '选择墙面…', attrs: { value: '', selected: !currentWallId } }),
    ...[...grouped.entries()].flatMap(([projectId, projectWalls]) => [
      h('optgroup', { attrs: { label: projectName.get(projectId) ?? projectId } },
        projectWalls.map((wall) => h('option', {
          text: wall.name,
          attrs: { value: wall.id, selected: wall.id === currentWallId },
        }))),
    ]),
  ])

  return h('label', { class: 'field', style: 'min-width:260px;margin:0' }, [select])
}

export async function requireWall(wallId: string | undefined): Promise<{ wall?: Awaited<ReturnType<typeof listWalls>>[number]; missing: boolean }> {
  if (!wallId) return { missing: true }
  const walls = await listWalls()
  const wall = walls.find((item) => item.id === wallId)
  return { wall, missing: !wall }
}
