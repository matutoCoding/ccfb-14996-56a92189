export type ID = string

export type WallShape = 'flat' | 'curved' | 'dome'

export interface Project {
  id: ID
  name: string
  client: string
  location: string
  note: string
  createdAt: number
  updatedAt: number
}

export interface Wall {
  id: ID
  projectId: ID
  name: string
  shape: WallShape
  widthM: number
  heightM: number
  radiusM: number
  orientationDeg: number
  createdAt: number
  updatedAt: number
}

export type MaterialCategory = 'glass' | 'gold' | 'stone'

export interface Material {
  id: ID
  numericCode: number
  code: string
  name: string
  category: MaterialCategory
  hex: string
  opacity: number
  roughness: number
  reflectivity: number
  relief: number
  metalness: number
  stock: number
  safetyStock: number
}

export interface SourceRecord {
  id: ID
  wallId: ID
  name: string
  dataUrl: string
  width: number
  height: number
  brightness: number
  contrast: number
  edgeSensitivity: number
  guideDensity: number
  faceFlow: number
  updatedAt: number
}

export interface GuideLine {
  kind: 'contour' | 'flow' | 'face'
  points: Array<{ x: number; y: number }>
}

export interface GuideField {
  cols: number
  rows: number
  angle: Float32Array
  strength: Float32Array
  lines: GuideLine[]
}

export interface LayoutParams {
  seed: string
  tileSizeMm: number
  gapMm: number
  cutRandom: number
  angleJitterDeg: number
  tiltMaxDeg: number
  followStrength: number
  maxColors: number
  wastePercent: number
}

export interface LayoutData {
  wallId: ID
  params: LayoutParams
  count: number
  positions: Float32Array
  sizes: Float32Array
  angles: Float32Array
  tilts: Float32Array
  sourceColors: Uint32Array
  materialCodes: Uint32Array
  updatedAt: number
}

export interface LayoutVersion extends LayoutData {
  id: ID
  version: number
  label: string
  createdAt: number
  auto: boolean
}

export interface MaterialUsage {
  material: Material
  count: number
  requiredWithWaste: number
  stock: number
  shortage: number
}

export interface MatchReport {
  total: number
  usedColorCount: number
  maxColors: number
  tooManyColors: boolean
  usages: MaterialUsage[]
  shortageCount: number
  shortagePieces: number
}

export type LightPresetId = 'daylight' | 'spot' | 'candle'

export interface LightSettings {
  preset: LightPresetId
  intensity: number
  warm: number
  showBlown: boolean
  timeOfDay: number
}

export interface RouteQuery {
  [key: string]: string
}
