import type { LightSettings, Wall } from '../core/types'

export interface LightUniforms {
  count: number
  types: Int32Array
  positions: Float32Array
  directions: Float32Array
  colors: Float32Array
  powers: Float32Array
  cones: Float32Array
}

export function createLightUniforms(): LightUniforms {
  return {
    count: 1,
    types: new Int32Array(4),
    positions: new Float32Array(12),
    directions: new Float32Array(12),
    colors: new Float32Array(12),
    powers: new Float32Array(4),
    cones: new Float32Array(4),
  }
}

function setLight(
  lights: LightUniforms,
  index: number,
  type: number,
  position: [number, number, number],
  direction: [number, number, number],
  color: [number, number, number],
  power: number,
  cone = 0.9,
): void {
  lights.types[index] = type
  lights.positions.set(position, index * 3)
  lights.directions.set(direction, index * 3)
  lights.colors.set(color, index * 3)
  lights.powers[index] = power
  lights.cones[index] = cone
}

export function configureLights(wall: Wall, settings: LightSettings, lights: LightUniforms): LightUniforms {
  const w = wall.widthM
  const h = wall.heightM
  const intensity = settings.intensity

  if (settings.preset === 'daylight') {
    const hour = settings.timeOfDay
    const dayPhase = Math.max(0, Math.min(1, (hour - 6) / 12))
    const sunAzimuth = 90 + dayPhase * 180
    const altitude = Math.sin(dayPhase * Math.PI) * 0.95 + 0.08
    const horizontal = Math.sqrt(Math.max(0, 1 - altitude * altitude))
    const delta = (sunAzimuth - wall.orientationDeg) * Math.PI / 180
    const direction: [number, number, number] = [
      Math.sin(delta) * horizontal,
      altitude,
      Math.cos(delta) * horizontal,
    ]
    const warm = settings.warm
    setLight(
      lights, 0, 0,
      [0, 0, 0],
      direction,
      [1, 0.93 - warm * 0.12, 0.78 - warm * 0.28],
      2.35 * intensity,
    )
    lights.count = 1
    return lights
  }

  if (settings.preset === 'spot') {
    const z = Math.max(1.8, w * 0.34)
    const xs = [-w * 0.31, 0, w * 0.31]
    xs.forEach((x, i) => {
      const position: [number, number, number] = [x, h / 2 + 0.35, z]
      const target: [number, number, number] = [x * 0.72, -h * 0.08, -wall.radiusM * 0.08]
      const direction: [number, number, number] = [
        target[0] - position[0],
        target[1] - position[1],
        target[2] - position[2],
      ]
      const length = Math.hypot(direction[0], direction[1], direction[2])
      direction[0] /= length
      direction[1] /= length
      direction[2] /= length
      setLight(lights, i, 1, position, direction, [1, 0.79, 0.55], 5.4 * intensity, Math.cos(27 * Math.PI / 180))
    })
    lights.count = 3
    return lights
  }

  const xs = [-w * 0.28, 0, w * 0.28]
  xs.forEach((x, i) => {
    setLight(
      lights, i, 2,
      [x, -h / 2 + 0.85, Math.max(0.9, w * 0.16)],
      [0, -1, 0],
      [1, 0.46 + i * 0.04, 0.14],
      3.1 * intensity,
    )
  })
  lights.count = 3
  return lights
}
