import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Offline support: only in the built app (the dev server has its own live
// reloading that a service worker would get in the way of).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
      const registration = await navigator.serviceWorker.ready
      // Give lazy-loaded pieces a moment to arrive, then ask the service
      // worker to keep everything this page needed.
      setTimeout(() => {
        const urls = performance.getEntriesByType('resource').map((entry) => entry.name)
        if (registration.active) registration.active.postMessage({ type: 'keep', urls })
      }, 4000)
    } catch {
      // no offline support in this browser — the app works online as before
    }
  })
}
