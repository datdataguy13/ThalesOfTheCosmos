import { useState, useRef, useEffect } from 'react'
import { askTheSky, SUGGESTIONS } from '../lib/askTheSky.js'
import { altOf } from '../astro.js'
import { useSpeech } from '../lib/useSpeech.js'

export default function AskSky({ sky, cityName, hourLabel, constellations }) {
  const [thread, setThread] = useState([])
  const [input, setInput] = useState('')
  const endRef = useRef(null)
  const { supported, speaking, speak, stop } = useSpeech()

  const ctx = { sky, cityName, hourLabel, constellations, altOf }

  function ask(question) {
    const q = question.trim()
    if (!q) return
    const answer = askTheSky(q, ctx)
    setThread((t) => [...t, { role: 'you', text: q }, { role: 'sky', text: answer }])
    setInput('')
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [thread])

  return (
    <div className="ask panel">
      <div className="ask-head">
        <div className="ask-orb" aria-hidden="true">✦</div>
        <div>
          <h3>Ask the sky</h3>
          <p className="light small">Type a question about space and the stars. Answers work offline and are made just for curious kids.</p>
        </div>
      </div>

      <div className="ask-thread">
        {thread.length === 0 && (
          <div className="ask-empty">
            <p className="light">Not sure what to ask? Try one of these:</p>
          </div>
        )}
        {thread.map((m, i) => (
          <div key={i} className={'bubble ' + m.role}>
            {m.role === 'sky' && <span className="who">The sky says</span>}
            <p>{m.text}</p>
            {m.role === 'sky' && supported && (
              <button
                className="mini-narrate"
                onClick={() => (speaking ? stop() : speak(m.text))}
              >
                {speaking ? '■ Stop' : '▶ Read aloud'}
              </button>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="chips suggest">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip tappable" onClick={() => ask(s)}>{s}</button>
        ))}
      </div>

      <form className="ask-form" onSubmit={(e) => { e.preventDefault(); ask(input) }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about the night sky…"
          aria-label="Ask a question about the night sky"
        />
        <button type="submit">Ask</button>
      </form>
    </div>
  )
}
