import { createDomeDataUrl, createGeometricDataUrl, createPortraitDataUrl } from '../core/samples'
import { seedMaterials } from '../core/materials'
import type { ID, Project, SourceRecord, Wall } from '../core/types'

const DB_NAME = 'mosaic-light-studio-db'
const DB_VERSION = 1

export const STORES = {
  projects: 'projects',
  walls: 'walls',
  sources: 'sources',
  layouts: 'layouts',
  versions: 'versions',
  materials: 'materials',
  meta: 'meta',
} as const

let dbPromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORES.projects)) db.createObjectStore(STORES.projects, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORES.walls)) {
        const store = db.createObjectStore(STORES.walls, { keyPath: 'id' })
        store.createIndex('projectId', 'projectId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORES.sources)) {
        const store = db.createObjectStore(STORES.sources, { keyPath: 'id' })
        store.createIndex('wallId', 'wallId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORES.layouts)) db.createObjectStore(STORES.layouts, { keyPath: 'wallId' })
      if (!db.objectStoreNames.contains(STORES.versions)) {
        const store = db.createObjectStore(STORES.versions, { keyPath: 'id' })
        store.createIndex('wallId', 'wallId', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORES.materials)) db.createObjectStore(STORES.materials, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORES.meta)) db.createObjectStore(STORES.meta, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDatabase()
  return dbPromise
}

function requestDone<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const request = tx.objectStore(storeName).getAll()
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

export async function getOne<T>(storeName: string, key: ID): Promise<T | undefined> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const request = tx.objectStore(storeName).get(key)
    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error)
  })
}

export async function putOne<T>(storeName: string, value: T): Promise<void> {
  const db = await getDB()
  await requestDone(db.transaction(storeName, 'readwrite').objectStore(storeName).put(value))
}

export async function putMany<T>(storeName: string, values: T[]): Promise<void> {
  if (values.length === 0) return
  const db = await getDB()
  const tx = db.transaction(storeName, 'readwrite')
  const store = tx.objectStore(storeName)
  for (const value of values) store.put(value)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function removeOne(storeName: string, key: ID): Promise<void> {
  const db = await getDB()
  await requestDone(db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key))
}

export async function getAllByIndex<T>(storeName: string, indexName: string, key: ID): Promise<T[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const request = tx.objectStore(storeName).index(indexName).getAll(key)
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

async function countStore(storeName: string): Promise<number> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function makeSource(wallId: string, name: string, dataUrl: string, width: number, height: number): SourceRecord {
  return {
    id: `src_${wallId}`,
    wallId,
    name,
    dataUrl,
    width,
    height,
    brightness: 100,
    contrast: 110,
    edgeSensitivity: 0.58,
    guideDensity: 0.62,
    faceFlow: 0.82,
    updatedAt: Date.now(),
  }
}

export async function ensureSeeded(): Promise<void> {
  const materialCount = await countStore(STORES.materials)
  if (materialCount === 0) await putMany(STORES.materials, seedMaterials())

  const projectCount = await countStore(STORES.projects)
  if (projectCount > 0) return

  const now = Date.now()
  const projects: Project[] = [
    {
      id: 'proj_portrait',
      name: '圣塞西莉亚教堂 · 人像墙',
      client: '热那亚教区修复工作室',
      location: '意大利 · 五渔村',
      note: '侧墙晨光从右侧高窗进入，需避免脸部高光死白。',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'proj_geometric',
      name: '阿特拉斯酒店 · 几何系列',
      client: 'Atlas Hospitality',
      location: '中国 · 上海',
      note: '大堂射灯洗墙，金箔比例需要随走动闪烁。',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'proj_dome',
      name: '海滨教堂 · 圣光大穹顶',
      client: 'Stella Maris',
      location: '葡萄牙 · 波尔图',
      note: '半圆形后殿，蜡烛与高窗自然光混合。',
      createdAt: now,
      updatedAt: now,
    },
  ]

  const walls: Wall[] = [
    {
      id: 'wall_portrait', projectId: 'proj_portrait', name: '中殿圣人像', shape: 'flat',
      widthM: 4, heightM: 5, radiusM: 0, orientationDeg: 155, createdAt: now, updatedAt: now,
    },
    {
      id: 'wall_geo', projectId: 'proj_geometric', name: '大堂放射主墙', shape: 'curved',
      widthM: 6, heightM: 3.6, radiusM: 8, orientationDeg: 180, createdAt: now, updatedAt: now,
    },
    {
      id: 'wall_stress', projectId: 'proj_geometric', name: '20㎡性能测试墙', shape: 'flat',
      widthM: 5, heightM: 4, radiusM: 0, orientationDeg: 180, createdAt: now, updatedAt: now,
    },
    {
      id: 'wall_dome', projectId: 'proj_dome', name: '半穹顶圣光', shape: 'dome',
      widthM: 6.28, heightM: 3.14, radiusM: 2, orientationDeg: 180, createdAt: now, updatedAt: now,
    },
  ]

  const sources: SourceRecord[] = [
    makeSource('wall_portrait', '手绘圣人像原稿', createPortraitDataUrl(), 800, 1000),
    makeSource('wall_geo', '放射几何图案', createGeometricDataUrl(), 1000, 1000),
    makeSource('wall_stress', '几何压测原稿', createGeometricDataUrl(), 1000, 1000),
    makeSource('wall_dome', '半穹顶星芒稿', createDomeDataUrl(), 1200, 640),
  ]

  await putMany(STORES.projects, projects)
  await putMany(STORES.walls, walls)
  await putMany(STORES.sources, sources)
}
