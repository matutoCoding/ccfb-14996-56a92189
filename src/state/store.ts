import {
  getAll,
  getAllByIndex,
  getOne,
  putOne,
  removeOne,
  STORES,
} from '../db/db'
import { createVersionFromLayout, restoreVersion } from '../core/layout'
import type {
  ID,
  LayoutData,
  LayoutVersion,
  Material,
  Project,
  SourceRecord,
  Wall,
} from '../core/types'

export const listProjects = (): Promise<Project[]> => getAll<Project>(STORES.projects)
export const listWalls = (): Promise<Wall[]> => getAll<Wall>(STORES.walls)
export const listMaterials = (): Promise<Material[]> => getAll<Material>(STORES.materials)
export const getProject = (id: ID): Promise<Project | undefined> => getOne<Project>(STORES.projects, id)
export const getWall = (id: ID): Promise<Wall | undefined> => getOne<Wall>(STORES.walls, id)
export const getMaterial = (id: ID): Promise<Material | undefined> => getOne<Material>(STORES.materials, id)
export const saveProject = (project: Project): Promise<void> => putOne(STORES.projects, project)
export const saveWall = (wall: Wall): Promise<void> => putOne(STORES.walls, wall)
export const saveMaterial = (material: Material): Promise<void> => putOne(STORES.materials, material)
export const removeMaterial = (id: ID): Promise<void> => removeOne(STORES.materials, id)

export async function getSourceForWall(wallId: ID): Promise<SourceRecord | undefined> {
  const items = await getAllByIndex<SourceRecord>(STORES.sources, 'wallId', wallId)
  return items[0]
}

export const saveSource = (source: SourceRecord): Promise<void> => putOne(STORES.sources, source)
export const getLayout = (wallId: ID): Promise<LayoutData | undefined> => getOne<LayoutData>(STORES.layouts, wallId)
export const saveLayout = (layout: LayoutData): Promise<void> => putOne(STORES.layouts, layout)

export async function listVersions(wallId: ID): Promise<LayoutVersion[]> {
  const versions = await getAllByIndex<LayoutVersion>(STORES.versions, 'wallId', wallId)
  return versions.sort((a, b) => b.createdAt - a.createdAt)
}

export async function commitLayoutVersion(
  layout: LayoutData,
  label: string,
  auto = false,
): Promise<LayoutVersion> {
  const existing = await listVersions(layout.wallId)
  const nextVersion = existing.reduce((max, item) => Math.max(max, item.version), 0) + 1
  const version = createVersionFromLayout(layout, nextVersion, label, auto)
  layout.updatedAt = version.createdAt
  await putOne(STORES.layouts, layout)
  await putOne(STORES.versions, version)
  return version
}

export async function restoreVersionById(versionId: ID): Promise<LayoutData> {
  const version = await getOne<LayoutVersion>(STORES.versions, versionId)
  if (!version) throw new Error('版本不存在')
  const layout = restoreVersion(version)
  await putOne(STORES.layouts, layout)
  return layout
}

export async function deleteProjectCascade(projectId: ID): Promise<void> {
  const walls = await getAllByIndex<Wall>(STORES.walls, 'projectId', projectId)
  for (const wall of walls) {
    const sources = await getAllByIndex<SourceRecord>(STORES.sources, 'wallId', wall.id)
    const versions = await getAllByIndex<LayoutVersion>(STORES.versions, 'wallId', wall.id)
    for (const source of sources) await removeOne(STORES.sources, source.id)
    for (const version of versions) await removeOne(STORES.versions, version.id)
    await removeOne(STORES.layouts, wall.id)
    await removeOne(STORES.walls, wall.id)
  }
  await removeOne(STORES.projects, projectId)
}

export async function deleteWallCascade(wallId: ID): Promise<void> {
  const sources = await getAllByIndex<SourceRecord>(STORES.sources, 'wallId', wallId)
  const versions = await getAllByIndex<LayoutVersion>(STORES.versions, 'wallId', wallId)
  for (const source of sources) await removeOne(STORES.sources, source.id)
  for (const version of versions) await removeOne(STORES.versions, version.id)
  await removeOne(STORES.layouts, wallId)
  await removeOne(STORES.walls, wallId)
}

export function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(timestamp))
}
