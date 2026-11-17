import { useState, useCallback, useMemo } from 'react'
import { load, save } from './storage.js'

// The stargazer's log: a checklist of things a child has really seen, saved on
// this device only. Each entry is an id such as "moon", "planet:Saturn",
// "con:Orion", "iss", "meteor" or "drawn:Orion" (from the drawing game).

const KEY = 'cosmos.log'

const count = (found, prefix) => Object.keys(found).filter((id) => id.startsWith(prefix)).length

// Each badge counts progress toward a goal.
export const BADGES = [
  { id: 'first-light', ico: '🌟', name: 'First Light', goal: 1, how: 'Spot your very first thing in the night sky',
    progress: (f) => Object.keys(f).filter((id) => !id.startsWith('drawn:')).length },
  { id: 'moon-watcher', ico: '🌙', name: 'Moon Watcher', goal: 1, how: 'Find the Moon', progress: (f) => (f.moon ? 1 : 0) },
  { id: 'planet-hunter', ico: '🪐', name: 'Planet Hunter', goal: 3, how: 'Spot 3 different planets', progress: (f) => count(f, 'planet:') },
  { id: 'star-hopper', ico: '⭐', name: 'Star Hopper', goal: 5, how: 'Find 5 constellations', progress: (f) => count(f, 'con:') },
  { id: 'myth-master', ico: '📜', name: 'Myth Master', goal: 10, how: 'Find 10 constellations', progress: (f) => count(f, 'con:') },
  { id: 'station-spotter', ico: '🛰️', name: 'Station Spotter', goal: 1, how: 'Watch the Space Station fly over', progress: (f) => (f.iss ? 1 : 0) },
  { id: 'wish-maker', ico: '🌠', name: 'Wish Maker', goal: 1, how: 'See a shooting star', progress: (f) => (f.meteor ? 1 : 0) },
  { id: 'star-artist', ico: '✏️', name: 'Star Artist', goal: 3, how: 'Draw 3 constellations in the game', progress: (f) => count(f, 'drawn:') },
  { id: 'sky-master', ico: '🏆', name: 'Sky Master', goal: 17, how: 'Find the Moon, 4 planets and 12 constellations',
    progress: (f) => (f.moon ? 1 : 0) + Math.min(4, count(f, 'planet:')) + Math.min(12, count(f, 'con:')) },
]

export function useStargazerLog() {
  const [found, setFound] = useState(() => load(KEY, {}))

  const update = useCallback((change) => {
    setFound((prev) => {
      const next = change(prev)
      save(KEY, next)
      return next
    })
  }, [])

  const toggle = useCallback((id) => update((prev) => {
    const next = { ...prev }
    if (next[id]) delete next[id]
    else next[id] = Date.now()
    return next
  }), [update])

  const mark = useCallback((id) => update((prev) => (prev[id] ? prev : { ...prev, [id]: Date.now() })), [update])

  const badges = useMemo(() => BADGES.map((b) => {
    const have = Math.min(b.goal, b.progress(found))
    return { ...b, have, earned: have >= b.goal }
  }), [found])

  return { found, toggle, mark, badges }
}
