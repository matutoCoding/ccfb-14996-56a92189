import { clampToWall, intersectWallRay } from '../core/geometry'
import type { Wall } from '../core/types'
import type { MosaicRenderer } from '../render/renderer'

interface DragState {
  pointerId: number
  type: 'orbit' | 'pan' | 'drag'
  index: number
  lastX: number
  lastY: number
  moved: boolean
}

export interface EditControlOptions {
  canvas: HTMLCanvasElement
  renderer: MosaicRenderer
  wall: Wall
  orbitMode: () => boolean
  onPick: (index: number) => void
  onDrag: (index: number, x: number, y: number) => void
  onDragEnd: (index: number) => void
}

export function attachEditorControls(options: EditControlOptions): () => void {
  const { canvas, renderer, wall } = options
  let state: DragState | null = null

  const down = (event: PointerEvent) => {
    event.preventDefault()
    canvas.setPointerCapture(event.pointerId)
    const isPan = event.button === 1 || event.shiftKey
    const isOrbitButton = event.button === 2
    if (isPan) {
      state = { pointerId: event.pointerId, type: 'pan', index: -1, lastX: event.clientX, lastY: event.clientY, moved: false }
      return
    }
    if (isOrbitButton || options.orbitMode()) {
      state = { pointerId: event.pointerId, type: 'orbit', index: -1, lastX: event.clientX, lastY: event.clientY, moved: false }
      return
    }
    if (event.button !== 0) return

    const index = renderer.pick(event.clientX, event.clientY)
    options.onPick(index)
    state = { pointerId: event.pointerId, type: index >= 0 ? 'drag' : 'orbit', index, lastX: event.clientX, lastY: event.clientY, moved: false }
  }

  const move = (event: PointerEvent) => {
    if (!state || state.pointerId !== event.pointerId) return
    const dx = event.clientX - state.lastX
    const dy = event.clientY - state.lastY
    if (Math.abs(dx) + Math.abs(dy) > 2) state.moved = true
    state.lastX = event.clientX
    state.lastY = event.clientY

    if (state.type === 'orbit') {
      renderer.camera.rotate(dx, dy)
      canvas.style.cursor = 'grabbing'
      return
    }
    if (state.type === 'pan') {
      const rect = canvas.getBoundingClientRect()
      renderer.camera.pan(dx, dy, rect.height)
      return
    }
    if (state.index < 0) return

    const ray = renderer.camera.ray(event.clientX, event.clientY, canvas.getBoundingClientRect())
    const hit = intersectWallRay(wall, ray)
    if (!hit) return
    const point = clampToWall(wall, hit.x, hit.y)
    options.onDrag(state.index, point.x, point.y)
  }

  const up = (event: PointerEvent) => {
    if (!state || state.pointerId !== event.pointerId) return
    if (state.type === 'drag' && state.index >= 0 && state.moved) options.onDragEnd(state.index)
    try { canvas.releasePointerCapture(event.pointerId) } catch { /* pointer already released */ }
    state = null
    canvas.style.cursor = 'crosshair'
  }

  const wheel = (event: WheelEvent) => {
    event.preventDefault()
    renderer.camera.zoom(Math.exp(event.deltaY * 0.0012))
  }
  const contextMenu = (event: MouseEvent) => event.preventDefault()

  canvas.style.cursor = 'crosshair'
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  canvas.addEventListener('wheel', wheel, { passive: false })
  canvas.addEventListener('contextmenu', contextMenu)

  return () => {
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointermove', move)
    canvas.removeEventListener('pointerup', up)
    canvas.removeEventListener('pointercancel', up)
    canvas.removeEventListener('wheel', wheel)
    canvas.removeEventListener('contextmenu', contextMenu)
  }
}

export function attachPreviewControls(canvas: HTMLCanvasElement, renderer: MosaicRenderer): () => void {
  let lastX = 0
  let lastY = 0
  let type: 'orbit' | 'pan' | null = null

  const down = (event: PointerEvent) => {
    event.preventDefault()
    canvas.setPointerCapture(event.pointerId)
    lastX = event.clientX
    lastY = event.clientY
    type = event.shiftKey || event.button === 1 ? 'pan' : 'orbit'
  }
  const move = (event: PointerEvent) => {
    if (!type) return
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY
    if (type === 'orbit') renderer.camera.rotate(dx, dy)
    else renderer.camera.pan(dx, dy, canvas.clientHeight)
  }
  const up = () => { type = null }
  const wheel = (event: WheelEvent) => {
    event.preventDefault()
    renderer.camera.zoom(Math.exp(event.deltaY * 0.0012))
  }
  const contextMenu = (event: MouseEvent) => event.preventDefault()

  canvas.style.cursor = 'grab'
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  canvas.addEventListener('wheel', wheel, { passive: false })
  canvas.addEventListener('contextmenu', contextMenu)
  return () => {
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointermove', move)
    canvas.removeEventListener('pointerup', up)
    canvas.removeEventListener('pointercancel', up)
    canvas.removeEventListener('wheel', wheel)
    canvas.removeEventListener('contextmenu', contextMenu)
  }
}
