// Small illustrative planet icons (not to scale) drawn as inline SVG.
export default function PlanetIcon({ planet, size = 52 }) {
  const c = planet.color
  const r = size * 0.3
  const cx = size / 2
  const cy = size / 2

  if (planet.key === 'Saturn') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <ellipse cx={cx} cy={cy} rx={size * 0.46} ry={size * 0.16} fill="none" stroke={c} strokeWidth="2.4" opacity="0.9" />
        <circle cx={cx} cy={cy} r={r} fill={c} />
        <ellipse cx={cx} cy={cy} rx={size * 0.46} ry={size * 0.16} fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="0.8" />
      </svg>
    )
  }
  if (planet.key === 'Jupiter') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs><clipPath id="jc"><circle cx={cx} cy={cy} r={r} /></clipPath></defs>
        <circle cx={cx} cy={cy} r={r} fill={c} />
        <g clipPath="url(#jc)" opacity="0.5" stroke="#9c7b52" strokeWidth="2">
          <line x1="0" y1={cy - 6} x2={size} y2={cy - 6} />
          <line x1="0" y1={cy + 2} x2={size} y2={cy + 2} />
          <line x1="0" y1={cy + 9} x2={size} y2={cy + 9} />
        </g>
        <circle cx={cx + r * 0.3} cy={cy + 2} r="2.2" fill="#c0603f" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <radialGradient id={'g' + planet.key} cx="35%" cy="32%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="60%" stopColor={c} />
          <stop offset="100%" stopColor={c} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#g${planet.key})`} />
    </svg>
  )
}
