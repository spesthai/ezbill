# Supabase Setup (EZBill)

## 1) Create a Supabase project

- Region: pick closest to Thailand if possible.
- Note the project URL and anon key (Settings -> API).

## 2) Configure Auth (landlord web)

- Auth -> Providers: enable Email (or your desired providers later).
- Auth -> URL Configuration:
  - Add redirect URLs for local dev: `http://localhost:5173`
  - Add redirect URLs for Cloudflare Pages:
    - `https://<your-pages-domain>.pages.dev`
    - and your custom domain if you use one

## 3) Create tables + RLS

- SQL editor: run `schema.sql`.
- This sets up tables and RLS for landlord access (`authenticated` only).
- Tenant H5 access is not direct; it should go through a Cloudflare Worker using `service_role`.

## 4) Environment variables

Landlord web requires:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Set them in:

- Local dev: create `apps/landlord-web/.env.local`
- Cloudflare Pages: Settings -> Environment variables

## 5) Validate

- Start dev server: `cd apps/landlord-web && npm run dev`
- App should show "Supabase env vars are configured".

