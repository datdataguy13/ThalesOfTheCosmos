// dome.js — the geometry behind the sky dome.
//
// Every star is turned into a direction in the observer's own frame:
//   x = east, y = north, z = straight up     (a unit vector)
// A "camera" is three such directions — right, up and forward — describing
// which way you're looking. Dragging with a cursor builds the camera from a
// compass direction and a height; on a phone it comes from the motion sensors.

import { altaz, DEG, RAD, n360 } from '../astro.js'

// Direction of a sky position (RA/Dec, degrees) for a place and moment.
export function toHorizon(ra, dec, lst, lat) {
  const { alt, az } = altaz(ra, dec, lst, lat)
  return fromAltAz(alt, az)
}

export function fromAltAz(alt, az) {
  const a = alt * DEG, z = az * DEG
  return [Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z), Math.sin(a)]
}

export function toAltAz(v) {
  return { alt: Math.asin(Math.max(-1, Math.min(1, v[2]))) * RAD, az: n360(Math.atan2(v[0], v[1]) * RAD) }
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit = (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n] }

// Camera looking toward compass direction `az` at height `alt`, held level.
export function cameraFromLook(az, alt) {
  const f = fromAltAz(alt, az)
  const r = [Math.cos(az * DEG), -Math.sin(az * DEG), 0]
  return { r, u: cross(r, f), f }
}

// Camera from a phone's orientation sensors, looking out through the back of
// the phone (as if the screen were a window). alpha/beta/gamma are the angles
// from a `deviceorientation` event, with alpha measured from north;
// `screenAngle` is how far the page is rotated from the phone's natural way up.
export function cameraFromDevice(alpha, beta, gamma, screenAngle = 0) {
  const a = alpha * DEG, b = beta * DEG, g = gamma * DEG
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g)
  // device axes (x: right edge, y: top edge, z: out of the screen) in the
  // east/north/up frame — the columns of Rz(alpha)·Rx(beta)·Ry(gamma)
  const X = [ca * cg - sa * sb * sg, sa * cg + ca * sb * sg, -cb * sg]
  const Y = [-sa * cb, ca * cb, sb]
  const Z = [ca * sg + sa * sb * cg, sa * sg - ca * sb * cg, cb * cg]
  const t = screenAngle * DEG, ct = Math.cos(t), st = Math.sin(t)
  return {
    r: [X[0] * ct - Y[0] * st, X[1] * ct - Y[1] * st, X[2] * ct - Y[2] * st],
    u: [X[0] * st + Y[0] * ct, X[1] * st + Y[1] * ct, X[2] * st + Y[2] * ct],
    f: [-Z[0], -Z[1], -Z[2]],
  }
}

// Turn the whole camera about the vertical by `deg` (clockwise seen from above).
export function turnCamera(cam, deg) {
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG)
  const turn = (v) => [v[0] * c + v[1] * s, -v[0] * s + v[1] * c, v[2]]
  return { r: turn(cam.r), u: turn(cam.u), f: turn(cam.f) }
}

// Blend toward a new camera to steady a jittery sensor, keeping it square.
export function blendCamera(from, to, amount) {
  // Blending only makes sense for small changes; after a big swing (or the
  // first reading) just jump, otherwise the view can end up mirrored.
  if (dot(from.f, to.f) < 0.9 || dot(from.r, to.r) < 0.9) return to
  const mix = (a, b) => [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount]
  const f = unit(mix(from.f, to.f))
  let r = mix(from.r, to.r)
  const along = dot(r, f)
  r = unit([r[0] - along * f[0], r[1] - along * f[1], r[2] - along * f[2]])
  return { r, u: cross(r, f), f }
}

// Pixels per unit of the projection so that `fov` degrees span `width` pixels.
export const scaleFor = (width, fov) => (width / 2) / (2 * Math.tan((fov * DEG) / 4))

// Stereographic projection of a direction onto the screen. It keeps shapes
// true even in a very wide view. Returns [x, y, depth]; depth runs from 1
// (dead ahead) to -1 (directly behind, which cannot be drawn).
export function project(v, cam, scale, cx, cy) {
  const depth = dot(v, cam.f)
  const k = scale * 2 / (1 + Math.max(depth, -0.999))
  return [cx + dot(v, cam.r) * k, cy - dot(v, cam.u) * k, depth]
}

// The horizon is a circle on the screen in this projection (or very nearly a
// straight line when you look right along it). Returns the circle and whether
// the ground is the inside of it.
export function horizonCircle(cam, scale, cx, cy) {
  const ahead = toAltAz(cam.f).az
  const pts = [-70, 0, 70].map((d) => project(fromAltAz(0, ahead + d), cam, scale, cx, cy))
  const [[x1, y1], [x2, y2], [x3, y3]] = pts
  // a point known to be on the ground side: straight down (or, if that is
  // behind us, straight up — which is on the sky side instead)
  const down = project([0, 0, -1], cam, scale, cx, cy)
  const probeIsGround = down[2] > -0.9
  const probe = probeIsGround ? down : project([0, 0, 1], cam, scale, cx, cy)
  // two points on the horizon, for drawing it as a straight line when the
  // circle is enormous
  const line = { a: pts[0], b: pts[2], probe, probeIsGround }
  const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2))
  if (Math.abs(d) < 1e-6) return { ...line, radius: Infinity }
  const s1 = x1 * x1 + y1 * y1, s2 = x2 * x2 + y2 * y2, s3 = x3 * x3 + y3 * y3
  const x = (s1 * (y2 - y3) + s2 * (y3 - y1) + s3 * (y1 - y2)) / d
  const y = (s1 * (x3 - x2) + s2 * (x1 - x3) + s3 * (x2 - x1)) / d
  const radius = Math.hypot(x1 - x, y1 - y)
  const probeInside = Math.hypot(probe[0] - x, probe[1] - y) < radius
  return { ...line, x, y, radius, groundInside: probeIsGround ? probeInside : !probeInside }
}
