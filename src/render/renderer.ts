import { hexToRgb } from '../core/color'
import type { LayoutData, LightSettings, Material, Wall } from '../core/types'
import { OrbitCamera } from './camera'
import { configureLights, createLightUniforms, type LightUniforms } from './lights'
import { mainFragmentShaderSource, pickFragmentShaderSource, vertexShaderSource } from './shaders'

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('无法创建 WebGL 着色器')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`着色器编译失败：${log ?? '未知错误'}`)
  }
  return shader
}

function createProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const program = gl.createProgram()
  if (!program) throw new Error('无法创建 WebGL Program')
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertex)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragment)
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`着色器链接失败：${gl.getProgramInfoLog(program) ?? '未知错误'}`)
  }
  return program
}

type UniformMap = Record<string, WebGLUniformLocation | null>

export class MosaicRenderer {
  readonly canvas: HTMLCanvasElement
  readonly gl: WebGL2RenderingContext
  readonly camera = new OrbitCamera()
  private program: WebGLProgram
  private pickProgram: WebGLProgram
  private uniforms: UniformMap = {}
  private pickUniforms: UniformMap = {}
  private vao: WebGLVertexArrayObject
  private buffers: Record<string, WebGLBuffer> = {}
  private layout: LayoutData | null = null
  private wall: Wall | null = null
  private materialByCode = new Map<number, Material>()
  private colorData = new Float32Array(0)
  private propsData = new Float32Array(0)
  private seedData = new Float32Array(0)
  private selected = -1
  private raf = 0
  private disposed = false
  private resizeObserver: ResizeObserver
  private lights: LightUniforms = createLightUniforms()
  private lightSettings: LightSettings = {
    preset: 'daylight', intensity: 1.15, warm: 0.25, showBlown: false, timeOfDay: 10.5,
  }
  private pickFramebuffer: WebGLFramebuffer | null = null
  private pickTexture: WebGLTexture | null = null
  private pickDepth: WebGLRenderbuffer | null = null
  private pickWidth = 0
  private pickHeight = 0

  constructor(canvas: HTMLCanvasElement, wall: Wall) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    })
    if (!gl) throw new Error('当前浏览器不支持 WebGL2，请使用最新版 Chrome / Edge / Firefox。')
    this.gl = gl
    this.wall = wall
    this.program = createProgram(gl, vertexShaderSource, mainFragmentShaderSource)
    this.pickProgram = createProgram(gl, vertexShaderSource, pickFragmentShaderSource)
    this.uniforms = this.collectUniforms(this.program)
    this.pickUniforms = this.collectUniforms(this.pickProgram)
    this.vao = this.createGeometry()
    this.camera.fit(wall.widthM, wall.heightM, wall.shape === 'flat' ? 0.2 : Math.max(0.8, wall.radiusM * 0.45))

    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.disable(gl.CULL_FACE)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0.19, 0.18, 0.165, 1)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    this.resize()
    this.camera.fit(
      wall.widthM,
      wall.heightM,
      wall.shape === 'flat' ? 0.2 : Math.max(0.8, wall.radiusM * 0.45),
      this.canvas.width / Math.max(1, this.canvas.height),
    )
    this.renderLoop()
  }

  private collectUniforms(program: WebGLProgram): UniformMap {
    const gl = this.gl
    const result: UniformMap = {}
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i)
      if (!info) continue
      const baseName = info.name.replace('[0]', '')
      result[info.name] = gl.getUniformLocation(program, info.name)
      if (info.name.endsWith('[0]')) result[baseName] = gl.getUniformLocation(program, baseName)
    }
    return result
  }

  private makeBuffer(name: string, location: number, size: number, divisor: number): void {
    const gl = this.gl
    const buffer = gl.createBuffer()
    if (!buffer) throw new Error('无法创建 WebGL 缓冲区')
    this.buffers[name] = buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0)
    if (divisor > 0) gl.vertexAttribDivisor(location, divisor)
  }

  private createGeometry(): WebGLVertexArrayObject {
    const gl = this.gl
    const vao = gl.createVertexArray()
    if (!vao) throw new Error('无法创建 WebGL VAO')
    gl.bindVertexArray(vao)

    const corner = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, corner)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    this.makeBuffer('center', 1, 2, 1)
    this.makeBuffer('size', 2, 2, 1)
    this.makeBuffer('angle', 3, 1, 1)
    this.makeBuffer('tilt', 4, 2, 1)
    this.makeBuffer('color', 5, 4, 1)
    this.makeBuffer('props', 6, 4, 1)
    this.makeBuffer('seed', 7, 1, 1)

    gl.bindVertexArray(null)
    return vao
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.55)
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr))
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
    this.gl.viewport(0, 0, width, height)
  }

  setSelected(index: number): void {
    this.selected = index
  }

  addMaterial(material: Material): void {
    this.materialByCode.set(material.numericCode, material)
  }

  getSelected(): number {
    return this.selected
  }

  setLightSettings(settings: LightSettings): void {
    this.lightSettings = { ...settings }
  }

  setWall(wall: Wall): void {
    this.wall = wall
    this.camera.fit(wall.widthM, wall.heightM, wall.shape === 'flat' ? 0.2 : Math.max(0.8, wall.radiusM * 0.45))
  }

  setLayout(layout: LayoutData, materials: Material[]): void {
    const gl = this.gl
    this.layout = layout
    this.materialByCode = new Map(materials.map((m) => [m.numericCode, m]))
    this.selected = -1
    const count = layout.count
    this.colorData = new Float32Array(count * 4)
    this.propsData = new Float32Array(count * 4)
    this.seedData = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      this.writeMaterialInto(i, false)
      this.seedData[i] = ((i + 1) * 2654435761 >>> 0) / 4294967295
    }

    gl.bindVertexArray(this.vao)
    this.uploadBuffer('center', layout.positions)
    this.uploadBuffer('size', layout.sizes)
    this.uploadBuffer('angle', layout.angles)
    this.uploadBuffer('tilt', layout.tilts)
    this.uploadBuffer('color', this.colorData)
    this.uploadBuffer('props', this.propsData)
    this.uploadBuffer('seed', this.seedData)
    gl.bindVertexArray(null)
  }

  private uploadBuffer(name: string, data: ArrayBufferView): void {
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[name])
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
  }

  private writeMaterialInto(index: number, upload: boolean): void {
    const layout = this.layout
    if (!layout) return
    const code = layout.materialCodes[index]
    const material = this.materialByCode.get(code)
    const rgb = material ? hexToRgb(material.hex) : { r: 255, g: 0, b: 255 }
    const ci = index * 4
    this.colorData[ci] = rgb.r / 255
    this.colorData[ci + 1] = rgb.g / 255
    this.colorData[ci + 2] = rgb.b / 255
    this.colorData[ci + 3] = material ? material.opacity : 1
    this.propsData[ci] = material ? material.roughness : 0.4
    this.propsData[ci + 1] = material ? material.reflectivity : 0.5
    this.propsData[ci + 2] = material ? material.relief : 0.3
    this.propsData[ci + 3] = material ? material.metalness : 0

    if (upload) {
      const gl = this.gl
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color)
      gl.bufferSubData(gl.ARRAY_BUFFER, index * 16, this.colorData.subarray(ci, ci + 4))
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.props)
      gl.bufferSubData(gl.ARRAY_BUFFER, index * 16, this.propsData.subarray(ci, ci + 4))
    }
  }

  refreshTileMaterial(index: number): void {
    this.writeMaterialInto(index, true)
  }

  uploadTileTransform(index: number): void {
    if (!this.layout) return
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.center)
    gl.bufferSubData(gl.ARRAY_BUFFER, index * 8, this.layout.positions.subarray(index * 2, index * 2 + 2))
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.angle)
    gl.bufferSubData(gl.ARRAY_BUFFER, index * 4, this.layout.angles.subarray(index, index + 1))
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.tilt)
    gl.bufferSubData(gl.ARRAY_BUFFER, index * 8, this.layout.tilts.subarray(index * 2, index * 2 + 2))
  }

  private setCommonUniforms(program: WebGLProgram, uniforms: UniformMap, viewProj: Float32Array): void {
    const gl = this.gl
    const wall = this.wall
    gl.useProgram(program)
    gl.uniformMatrix4fv(uniforms.u_viewProj, false, viewProj)
    if (wall) {
      const shape = wall.shape === 'flat' ? 0 : wall.shape === 'curved' ? 1 : 2
      gl.uniform1i(uniforms.u_shape, shape)
      gl.uniform1f(uniforms.u_width, wall.widthM)
      gl.uniform1f(uniforms.u_height, wall.heightM)
      gl.uniform1f(uniforms.u_radius, wall.radiusM > 0 ? wall.radiusM : wall.widthM / Math.PI)
    }
  }

  private renderLoop = (): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.renderLoop)
    this.resize()
    this.drawMain()
  }

  private drawMain(): void {
    const gl = this.gl
    const wall = this.wall
    if (!wall) return
    const viewProj = this.camera.update(this.canvas.width / Math.max(1, this.canvas.height))
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    if (!this.layout || this.layout.count === 0) return

    const lights = configureLights(wall, this.lightSettings, this.lights)
    this.setCommonUniforms(this.program, this.uniforms, viewProj)
    const u = this.uniforms
    gl.uniform3fv(u.u_cameraPos, this.camera.position())
    gl.uniform1f(u.u_time, performance.now() / 1000)
    gl.uniform1i(u.u_selected, this.selected)
    gl.uniform1i(u.u_showBlown, this.lightSettings.showBlown ? 1 : 0)
    gl.uniform1f(u.u_exposure, this.lightSettings.preset === 'candle' ? 1.28 : 1.08)
    gl.uniform1i(u.u_lightCount, lights.count)
    gl.uniform1iv(u['u_lightType[0]'] ?? u.u_lightType ?? null, lights.types)
    gl.uniform3fv(u['u_lightPos[0]'] ?? u.u_lightPos ?? null, lights.positions)
    gl.uniform3fv(u['u_lightDir[0]'] ?? u.u_lightDir ?? null, lights.directions)
    gl.uniform3fv(u['u_lightColor[0]'] ?? u.u_lightColor ?? null, lights.colors)
    gl.uniform1fv(u['u_lightPower[0]'] ?? u.u_lightPower ?? null, lights.powers)
    gl.uniform1fv(u['u_lightCone[0]'] ?? u.u_lightCone ?? null, lights.cones)

    gl.bindVertexArray(this.vao)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.layout.count)
    gl.bindVertexArray(null)
  }

  private ensurePickTarget(width: number, height: number): void {
    if (this.pickFramebuffer && this.pickWidth === width && this.pickHeight === height) return
    const gl = this.gl
    if (this.pickFramebuffer) gl.deleteFramebuffer(this.pickFramebuffer)
    if (this.pickTexture) gl.deleteTexture(this.pickTexture)
    if (this.pickDepth) gl.deleteRenderbuffer(this.pickDepth)

    this.pickFramebuffer = gl.createFramebuffer()
    this.pickTexture = gl.createTexture()
    this.pickDepth = gl.createRenderbuffer()
    this.pickWidth = width
    this.pickHeight = height

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickFramebuffer)
    gl.bindTexture(gl.TEXTURE_2D, this.pickTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pickTexture, 0)
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.pickDepth)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.pickDepth)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  pick(clientX: number, clientY: number): number {
    if (!this.layout || this.layout.count === 0 || !this.wall) return -1
    const gl = this.gl
    const rect = this.canvas.getBoundingClientRect()
    const x = Math.floor((clientX - rect.left) * this.canvas.width / rect.width)
    const y = Math.floor(this.canvas.height - (clientY - rect.top) * this.canvas.height / rect.height)
    this.ensurePickTarget(this.canvas.width, this.canvas.height)

    const viewProj = this.camera.update(this.canvas.width / Math.max(1, this.canvas.height))
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickFramebuffer)
    gl.viewport(0, 0, this.pickWidth, this.pickHeight)
    gl.disable(gl.BLEND)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    this.setCommonUniforms(this.pickProgram, this.pickUniforms, viewProj)
    gl.bindVertexArray(this.vao)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.layout.count)

    const pixel = new Uint8Array(4)
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
    gl.bindVertexArray(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.enable(gl.BLEND)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0.19, 0.18, 0.165, 1)

    if (pixel[3] === 0) return -1
    const id = pixel[0] + pixel[1] * 256 + pixel[2] * 65536
    return id - 1
  }

  screenshotDataUrl(): string {
    this.drawMain()
    return this.canvas.toDataURL('image/png')
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    const ext = this.gl.getExtension('WEBGL_lose_context')
    ext?.loseContext()
  }
}
