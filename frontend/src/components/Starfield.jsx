import { useRef, useEffect } from 'react'

// Gently twinkling starfield for the hero background.
export default function Starfield() {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const dpr = window.devicePixelRatio || 1
    let raf, stars = [], ctx, rect
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function size() {
      rect = cv.parentElement.getBoundingClientRect()
      cv.width = rect.width * dpr
      cv.height = rect.height * dpr
      ctx = cv.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      stars = []
      const n = Math.round((rect.width * rect.height) / 5500)
      for (let i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * rect.width,
          y: Math.random() * rect.height,
          r: Math.random() * 1.3 + 0.2,
          p: Math.random() * Math.PI * 2,
          sp: Math.random() * 2 + 0.5,
        })
      }
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(cv.parentElement)

    let t = 0
    function frame() {
      t += 0.016
      ctx.clearRect(0, 0, rect.width, rect.height)
      for (const s of stars) {
        const tw = 0.5 + 0.5 * Math.sin(t * s.sp + s.p)
        ctx.globalAlpha = 0.3 + tw * 0.7
        ctx.fillStyle = '#dfe6ff'
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, 2 * Math.PI)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }
    function still() {
      ctx.clearRect(0, 0, rect.width, rect.height)
      for (const s of stars) {
        ctx.globalAlpha = 0.6
        ctx.fillStyle = '#dfe6ff'
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, 2 * Math.PI)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    if (reduce) still()
    else frame()

    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])
  return <canvas className="stars" ref={ref} />
}
