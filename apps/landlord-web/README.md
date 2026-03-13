# Landlord Web (React + TS + Vite)

## Local dev

- Install: `npm i`
- Run: `npm run dev`

## Supabase

- Create a Supabase project and run `supabase/schema.sql` in SQL editor.
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`).
- Auth redirect URLs should include:
  - `http://localhost:5173`
  - your Cloudflare Pages URLs (`https://<name>.pages.dev`, and custom domain if any)

## Build

- `npm run build`
- Output: `dist/`

## Cloudflare Pages

- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: use `.nvmrc` (Node 22)
- SPA routing: `public/_redirects`
- Cache headers: `public/_headers` (hashed assets immutable)

## PWA / Offline

- Uses `vite-plugin-pwa`
- Precaches static assets for offline load; replace `public/pwa-icon.svg` with real icons later
