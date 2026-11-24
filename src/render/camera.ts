import { cross3, lookAt, multiply, normalize3, perspective, type Mat4, type Vec3 } from './mat4'
import type { Ray } from '../core/geometry'

export class OrbitCamera {
  yaw = 0
  pitch = 0.04
  distance = 8
  target: Vec3 = [0, 0, 0]
  fov = 42 * Math.PI / 180
  private proj: Mat4 = new Float32Array(16)
  private view: Mat4 = new Float32Array(16)
  viewProj: Mat4 = new Float32Array(16)

  position(): Vec3 {
    const cp = Math.cos(this.pitch)
    return [
      this.target[0] + this.distance * Math.sin(this.yaw) * cp,
      this.target[1] + this.distance * Math.sin(this.pitch),
      this.target[2] + this.distance * Math.cos(this.yaw) * cp,
    ]
  }

  fit(widthM: number, heightM: number, depthM = 1, viewAspect?: number): void {
    const aspect = Math.max(0.35, viewAspect ?? widthM / Math.max(1, heightM))
    const visible = Math.max(heightM * 1.12, widthM / aspect * 1.12, depthM * 2.4)
    this.distance = visible / (2 * Math.tan(this.fov / 2)) + depthM * 0.35
    this.target = [0, 0, -depthM * 0.18]
    this.yaw = 0
    this.pitch = 0.035
  }

  rotate(deltaX: number, deltaY: number): void {
    this.yaw -= deltaX * 0.006
    this.pitch += deltaY * 0.005
    this.pitch = Math.max(-1.15, Math.min(1.15, this.pitch))
  }

  zoom(scale: number): void {
    this.distance = Math.max(0.35, Math.min(80, this.distance * scale))
  }

  pan(deltaXPx: number, deltaYPx: number, canvasHeightPx: number): void {
    const eye = this.position()
    const forward = normalize3([
      this.target[0] - eye[0],
      this.target[1] - eye[1],
      this.target[2] - eye[2],
    ])
    const right = normalize3(cross3(forward, [0, 1, 0]))
    const up = normalize3(cross3(right, forward))
    const worldPerPixel = 2 * this.distance * Math.tan(this.fov / 2) / Math.max(1, canvasHeightPx)
    const dx = -deltaXPx * worldPerPixel
    const dy = deltaYPx * worldPerPixel
    this.target[0] += right[0] * dx + up[0] * dy
    this.target[1] += right[1] * dx + up[1] * dy
    this.target[2] += right[2] * dx + up[2] * dy
  }

  update(aspect: number): Mat4 {
    perspective(this.proj, this.fov, aspect, 0.03, 120)
    lookAt(this.view, this.position(), this.target, [0, 1, 0])
    multiply(this.viewProj, this.proj, this.view)
    return this.viewProj
  }

  ray(clientX: number, clientY: number, rect: DOMRect): Ray {
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1)
    const eye = this.position()
    const forward = normalize3([
      this.target[0] - eye[0],
      this.target[1] - eye[1],
      this.target[2] - eye[2],
    ])
    const right = normalize3(cross3(forward, [0, 1, 0]))
    const up = normalize3(cross3(right, forward))
    const tan = Math.tan(this.fov / 2)
    const aspect = rect.width / Math.max(1, rect.height)
    const direction = normalize3([
      forward[0] + right[0] * nx * tan * aspect + up[0] * ny * tan,
      forward[1] + right[1] * nx * tan * aspect + up[1] * ny * tan,
      forward[2] + right[2] * nx * tan * aspect + up[2] * ny * tan,
    ])
    return { origin: eye, direction }
  }
}
