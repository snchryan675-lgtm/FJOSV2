# FJOS Web
Run: `npm install` then `npm start` (http://localhost:3000, set PORT to change). Needs Node 18+.

To let people on locked-down PCs use it, host it somewhere public (Render, Railway, Fly.io, any VPS) with start command `npm start`.

- Files and the VS Code app store everything in each visitor's own browser (IndexedDB), nothing is saved on your server.
- The Browser and web apps load pages through `/proxy`, which strips frame-blocking headers and rewrites links. It blocks private/internal addresses.
- Desktop-only features were removed (Roblox, Steam, running real .exe files). .jsdos/.zip DOS bundles still run.
- Live Server opens a blob URL (no auto-reload, relative assets won't load).
