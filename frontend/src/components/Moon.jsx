import { useRef, useEffect } from 'react'

// Draws the Moon with a correctly-curved terminator for the given illuminated
// fraction. `flip` mirrors it for the southern hemisphere, where the lit side
// appears on the opposite side compared to the northern view.
export function drawMoon(canvas, frac, size, flip) {
  const dpr = window.devicePixelRatio || 1
  canvas.width = size * dpr
  canvas.height = size * dpr
  canvas.style.width = size + 'px'
  canvas.style.height = size + 'px'
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const R = size / 2 - 2
  const cx = size / 2
  const cy = size / 2
  ctx.clearRect(0, 0, size, size)

  if (flip) {
    ctx.save()
    ctx.translate(size, 0)
    ctx.scale(-1, 1)
  }

  // dark side
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, 2 * Math.PI)
  ctx.fillStyle = '#1a2140'
  ctx.fill()

  ctx.save()
  ctx.clip()
  // lit side, built from scanlines
  const theta = 2 * Math.PI * frac
  const c = Math.cos(theta)
  const grd = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R * 1.2)
  grd.addColorStop(0, '#fdfbf2')
  grd.addColorStop(1, '#d9d2b8')
  ctx.fillStyle = grd
  for (let y = -R; y <= R; y += 1) {
    const xl = Math.sqrt(Math.max(0, R * R - y * y))
    const xt = xl * c
    let a, b
    if (frac <= 0.5) { a = xt; b = xl } else { a = -xl; b = -xt }
    if (b > a) ctx.fillRect(cx + a, cy + y, b - a, 1.3)
  }
  // soft craters on the lit area
  ctx.globalAlpha = 0.1
  ctx.fillStyle = '#7a7254'
  const craters = [[.32, .35, .12], [.58, .28, .08], [.46, .62, .14], [.68, .58, .07], [.40, .46, .06]]
  for (const [u, v, s] of craters) {
    ctx.beginPath()
    ctx.arc(cx + (u - .5) * 2 * R, cy + (v - .5) * 2 * R, s * R, 0, 2 * Math.PI)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.restore()

  // rim
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, 2 * Math.PI)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1
  ctx.stroke()

  if (flip) ctx.restore()
}

export default function Moon({ frac, size = 210, flip = false }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) drawMoon(ref.current, frac, size, flip)
  }, [frac, size, flip])
  return <canvas ref={ref} className="moon-canvas" />
}
