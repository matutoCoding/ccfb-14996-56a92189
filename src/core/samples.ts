function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法生成测试原稿')
  return [canvas, ctx]
}

function url(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/jpeg', 0.92)
}

function poly(ctx: CanvasRenderingContext2D, points: number[][], fill: string): void {
  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

export function createPortraitDataUrl(): string {
  const [canvas, ctx] = makeCanvas(800, 1000)

  const bg = ctx.createLinearGradient(0, 0, 0, 1000)
  bg.addColorStop(0, '#d8c3a0')
  bg.addColorStop(0.55, '#b99a72')
  bg.addColorStop(1, '#7d654c')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 800, 1000)

  // 背景拱券
  ctx.strokeStyle = 'rgba(92,66,45,.34)'
  ctx.lineWidth = 26
  ctx.beginPath()
  ctx.arc(400, 430, 310, Math.PI, 0)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,239,196,.28)'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.arc(400, 430, 270, Math.PI, 0)
  ctx.stroke()

  // 衣服和肩
  const robe = ctx.createLinearGradient(180, 620, 620, 1000)
  robe.addColorStop(0, '#244a72')
  robe.addColorStop(0.55, '#173454')
  robe.addColorStop(1, '#0d2238')
  ctx.beginPath()
  ctx.moveTo(120, 1000)
  ctx.bezierCurveTo(160, 760, 260, 650, 400, 650)
  ctx.bezierCurveTo(540, 650, 650, 770, 690, 1000)
  ctx.closePath()
  ctx.fillStyle = robe
  ctx.fill()

  // 衣褶
  ctx.lineCap = 'round'
  const folds = [
    [330, 690, 270, 820, 235, 1000],
    [400, 690, 390, 835, 400, 1000],
    [470, 690, 535, 835, 575, 1000],
    [285, 735, 330, 850, 315, 1000],
    [520, 740, 470, 870, 485, 1000],
  ]
  for (const f of folds) {
    ctx.strokeStyle = 'rgba(126,180,214,.34)'
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.moveTo(f[0], f[1])
    ctx.quadraticCurveTo(f[2], f[3], f[4], f[5])
    ctx.stroke()
    ctx.strokeStyle = 'rgba(5,18,34,.35)'
    ctx.lineWidth = 5
    ctx.stroke()
  }

  // 脖子
  ctx.fillStyle = '#c98d6d'
  ctx.beginPath()
  ctx.roundRect?.(350, 520, 100, 170, 38)
  if (!ctx.roundRect) ctx.rect(350, 520, 100, 170)
  ctx.fill()
  ctx.fillStyle = 'rgba(112,55,42,.22)'
  ctx.fillRect(350, 620, 100, 34)

  // 头发后层
  ctx.fillStyle = '#3a241b'
  ctx.beginPath()
  ctx.ellipse(400, 360, 178, 220, 0, 0, Math.PI * 2)
  ctx.fill()

  // 脸
  const skin = ctx.createRadialGradient(360, 300, 40, 400, 390, 190)
  skin.addColorStop(0, '#f0c4a4')
  skin.addColorStop(0.7, '#d79a78')
  skin.addColorStop(1, '#a9654e')
  ctx.beginPath()
  ctx.ellipse(400, 390, 132, 172, 0, 0, Math.PI * 2)
  ctx.fillStyle = skin
  ctx.fill()

  // 头发前层和卷
  ctx.fillStyle = '#2b1a14'
  ctx.beginPath()
  ctx.moveTo(268, 340)
  ctx.bezierCurveTo(275, 190, 350, 145, 430, 170)
  ctx.bezierCurveTo(520, 198, 548, 280, 528, 370)
  ctx.bezierCurveTo(500, 285, 470, 245, 410, 238)
  ctx.bezierCurveTo(350, 232, 310, 270, 268, 340)
  ctx.fill()
  for (let i = 0; i < 18; i++) {
    const x = 285 + (i % 9) * 29
    const y = 210 + Math.floor(i / 9) * 34 + Math.sin(i) * 10
    ctx.beginPath()
    ctx.arc(x, y, 20 + (i % 3) * 4, 0, Math.PI * 2)
    ctx.fillStyle = i % 2 ? '#4a2d20' : '#332017'
    ctx.fill()
  }

  // 五官
  ctx.strokeStyle = '#4a2a22'
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(326, 370); ctx.quadraticCurveTo(356, 352, 382, 370); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(420, 370); ctx.quadraticCurveTo(450, 352, 478, 370); ctx.stroke()
  ctx.fillStyle = '#f4e7d8'
  ctx.beginPath(); ctx.ellipse(356, 397, 25, 12, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(446, 397, 25, 12, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#2a211d'
  ctx.beginPath(); ctx.arc(358, 398, 7, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(444, 398, 7, 0, Math.PI * 2); ctx.fill()

  ctx.strokeStyle = 'rgba(126,72,55,.72)'
  ctx.lineWidth = 7
  ctx.beginPath(); ctx.moveTo(402, 405); ctx.quadraticCurveTo(392, 450, 405, 468); ctx.quadraticCurveTo(418, 474, 428, 466); ctx.stroke()
  ctx.strokeStyle = '#8e3d3d'
  ctx.lineWidth = 10
  ctx.beginPath(); ctx.moveTo(360, 505); ctx.quadraticCurveTo(400, 526, 442, 505); ctx.quadraticCurveTo(402, 535, 360, 505); ctx.stroke()

  // 高光与原稿颗粒
  ctx.fillStyle = 'rgba(255,244,214,.16)'
  ctx.beginPath(); ctx.ellipse(350, 330, 34, 58, -0.35, 0, Math.PI * 2); ctx.fill()
  for (let i = 0; i < 5000; i++) {
    const x = (i * 137) % 800
    const y = (i * 241) % 1000
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.025)'
    ctx.fillRect(x, y, 2, 2)
  }

  return url(canvas)
}

export function createGeometricDataUrl(): string {
  const [canvas, ctx] = makeCanvas(1000, 1000)
  ctx.fillStyle = '#10243d'
  ctx.fillRect(0, 0, 1000, 1000)

  const cx = 500
  const cy = 500
  for (let i = 0; i < 72; i++) {
    const a0 = (i / 72) * Math.PI * 2
    const a1 = ((i + 1) / 72) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, 720, a0, a1)
    ctx.closePath()
    ctx.fillStyle = i % 2 === 0 ? '#c89b3c' : (i % 4 === 0 ? '#2f7894' : '#efe0b4')
    ctx.globalAlpha = i % 2 === 0 ? 0.82 : 0.95
    ctx.fill()
  }
  ctx.globalAlpha = 1

  const rings = [430, 350, 270, 180, 92]
  rings.forEach((r, i) => {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = ['#173b5c', '#b7472f', '#f0d488', '#244a72', '#e9e2c7'][i]
    ctx.fill()
    ctx.strokeStyle = '#f6e7b1'
    ctx.lineWidth = 10
    ctx.stroke()
  })

  for (let i = 0; i < 12; i++) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((i / 12) * Math.PI * 2)
    poly(ctx, [[0, -170], [34, -70], [0, -96], [-34, -70]], i % 2 ? '#f4c95d' : '#fff0b8')
    ctx.restore()
  }

  ctx.beginPath()
  ctx.arc(cx, cy, 58, 0, Math.PI * 2)
  ctx.fillStyle = '#fff4c8'
  ctx.fill()
  ctx.strokeStyle = '#8a5b18'
  ctx.lineWidth = 8
  ctx.stroke()

  ctx.strokeStyle = 'rgba(255,255,255,.22)'
  ctx.lineWidth = 3
  for (let x = 40; x < 1000; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1000); ctx.stroke()
  }
  for (let y = 40; y < 1000; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1000, y); ctx.stroke()
  }
  return url(canvas)
}

export function createDomeDataUrl(): string {
  const [canvas, ctx] = makeCanvas(1200, 640)
  const sky = ctx.createLinearGradient(0, 0, 0, 640)
  sky.addColorStop(0, '#182b59')
  sky.addColorStop(0.55, '#294f86')
  sky.addColorStop(1, '#8db7cf')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 1200, 640)

  // 穹顶放射肋
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24) * 1200
    const grad = ctx.createLinearGradient(600, 0, x, 640)
    grad.addColorStop(0, 'rgba(255,226,142,.95)')
    grad.addColorStop(1, 'rgba(174,116,35,.28)')
    ctx.strokeStyle = grad
    ctx.lineWidth = i % 2 ? 5 : 10
    ctx.beginPath()
    ctx.moveTo(600, 18)
    ctx.quadraticCurveTo(600 + (x - 600) * 0.25, 260, x, 640)
    ctx.stroke()
  }

  // 中央金色光轮
  const glow = ctx.createRadialGradient(600, 190, 20, 600, 190, 250)
  glow.addColorStop(0, '#fff8cf')
  glow.addColorStop(0.35, '#e8c45d')
  glow.addColorStop(1, 'rgba(196,139,35,0)')
  ctx.fillStyle = glow
  ctx.fillRect(330, 0, 540, 430)
  ctx.beginPath(); ctx.arc(600, 190, 142, 0, Math.PI * 2)
  ctx.fillStyle = '#d9af42'; ctx.fill()
  ctx.beginPath(); ctx.arc(600, 190, 108, 0, Math.PI * 2)
  ctx.fillStyle = '#f5df91'; ctx.fill()
  ctx.beginPath(); ctx.arc(600, 190, 72, 0, Math.PI * 2)
  ctx.fillStyle = '#fdf3c4'; ctx.fill()

  // 星点
  for (let i = 0; i < 90; i++) {
    const x = (i * 197) % 1200
    const y = 40 + ((i * 83) % 430)
    const r = 3 + (i % 5)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(i)
    poly(ctx, [[0, -r * 2.4], [r * .55, -r * .55], [r * 2.4, 0], [r * .55, r * .55], [0, r * 2.4], [-r * .55, r * .55], [-r * 2.4, 0], [-r * .55, -r * .55]], i % 4 === 0 ? '#f6d46e' : '#f4f0d6')
    ctx.restore()
  }

  // 底部连续拱廊
  for (let i = 0; i < 6; i++) {
    const x = i * 200
    ctx.fillStyle = 'rgba(116,72,38,.55)'
    ctx.beginPath()
    ctx.moveTo(x, 640)
    ctx.lineTo(x, 500)
    ctx.quadraticCurveTo(x + 100, 390, x + 200, 500)
    ctx.lineTo(x + 200, 640)
    ctx.fill()
    ctx.strokeStyle = '#e1bd63'
    ctx.lineWidth = 8
    ctx.stroke()
  }

  return url(canvas)
}
