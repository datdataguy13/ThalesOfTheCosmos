import { useState, useEffect, useRef, useCallback } from 'react'

// Tiny wrapper around the browser's built-in speech synthesis, tuned to read
// stories aloud for kids (a slightly slower, clear voice). No network needed.
export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = useState(false)
  const idRef = useRef(0)

  useEffect(() => {
    // Prompt some browsers to populate the voice list.
    if (supported) window.speechSynthesis.getVoices()
    return () => { if (supported) window.speechSynthesis.cancel() }
  }, [supported])

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback((text) => {
    if (!supported || !text) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.95
    u.pitch = 1.05
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find((v) => /female|samantha|karen|moira|tessa|zira|google uk english female/i.test(v.name))
      || voices.find((v) => v.lang && v.lang.startsWith('en'))
    if (preferred) u.voice = preferred
    const myId = ++idRef.current
    u.onend = () => { if (idRef.current === myId) setSpeaking(false) }
    u.onerror = () => { if (idRef.current === myId) setSpeaking(false) }
    setSpeaking(true)
    window.speechSynthesis.speak(u)
  }, [supported])

  return { supported, speaking, speak, stop }
}
