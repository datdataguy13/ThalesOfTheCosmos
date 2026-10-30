import { useEffect } from 'react'
import ConstellationCanvas from './ConstellationCanvas.jsx'
import { altOf } from '../astro.js'
import { useSpeech } from '../lib/useSpeech.js'

export default function ConstellationModal({ c, sky, cityName, hourLabel, onClose }) {
  const { supported, speaking, speak, stop } = useSpeech()

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      stop()
    }
  }, [onClose, stop])

  const alt = altOf(c.ra, c.dec, sky)
  const vis = alt > 12
    ? ['hi', 'High in the sky — easy to find now']
    : alt > 0
      ? ['lo', 'Low on the horizon right now']
      : ['no', 'Below the horizon at this time']

  const narration = `${c.name}. ${c.title}. ${c.story.join(' ')} How to find it. ${c.find} Did you know? ${c.fact}`

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={c.name}>
        <div className="msky">
          <ConstellationCanvas data={c} ratio={0.42} maxHeight={260} />
          <button className="mclose" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <span className="tag">{c.hemi} · best {c.season}</span>
          <div className="modal-titlerow">
            <h2>{c.name} — {c.title}</h2>
            {supported && (
              <button className="narrate" onClick={() => (speaking ? stop() : speak(narration))}>
                {speaking ? '■ Stop' : '▶ Read it to me'}
              </button>
            )}
          </div>
          <div className="chips">
            <span className={'vis ' + vis[0]}>{vis[1]}</span>
            <span className="chip">Height now: <b>{Math.round(alt)}°</b></span>
            <span className="chip">From <b>{cityName}</b> at {hourLabel}</span>
          </div>
          <div className="factbox">
            <div className="k">How to find it</div>
            <p className="light">{c.find}</p>
          </div>
          {c.story.map((s, i) => <p className="story" key={i}>{s}</p>)}
          <div className="factbox">
            <div className="k">Did you know?</div>
            <p>{c.fact}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
