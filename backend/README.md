# backend (not needed yet)

The current version of **Thales of the Cosmos** runs entirely in the browser:

- **Location** comes from the browser's own geolocation.
- **Weather** comes from the free, key-less [Open-Meteo](https://open-meteo.com) API, called directly from the frontend.
- **"Ask the sky"** is a fully offline, kid-safe answer engine (`frontend/src/lib/askTheSky.js`) — no AI service, nothing leaves the device.

So there is nothing to run here right now.

## When you'd add a backend

You'd want a small server in this folder if you later decide to:

- **Use real Claude AI for "Ask the sky".** An API key must never live in browser code, so you'd add a tiny proxy here (e.g. an Express route) that holds the key in an environment variable and forwards questions to the Anthropic API.
- **Cache or rate-limit** weather/geocoding requests.
- **Add accounts or saved favourites.**

Until then, this folder is intentionally empty.
