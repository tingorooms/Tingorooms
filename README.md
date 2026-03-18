# Room Rental Management Platform

Production-ready full-stack room rental platform with:

- React + TypeScript + Vite frontend
- Node.js + Express backend
- MySQL (TiDB compatible SQL patterns)
- Realtime chat + browser push notifications
- Admin + broker + member flows

## Features

- Public room browsing with advanced filters and search
- Room detail pages with owner info and direct chat initiation
- Realtime chat with notifications
- Web Push notifications (works when browser tab is closed)
- Dashboard for room posting and management
- Admin panel for users, rooms, ads, plans, reports, and site settings
- Contact leads tracking and business analytics

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, Radix UI, React Router
- UI Motion: Framer Motion
- Backend: Express, mysql2, JWT auth, multer upload
- Realtime: Supabase Realtime + in-app notification services
- Push: VAPID + service worker + web-push

## Project Structure

- `src/` Frontend app code
- `backend/` API server and DB scripts
- `public/` Static assets, service worker, fallback site settings
- `scripts/` Utility/perf scripts

## Local Development

### 1. Install dependencies

Frontend:

```bash
npm install
```

Backend:

```bash
cd backend
npm install
```

### 2. Configure environment variables

Frontend `.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Backend `backend/.env`:

```env
PORT=5000
DB_HOST=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
JWT_SECRET=...

# Web push
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```

### 3. Run app

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Push Notification Setup

Generate VAPID keys once:

```bash
npx web-push generate-vapid-keys
```

Set generated keys in backend environment and redeploy backend service.

## Deployment

- Frontend: Vercel
- Backend: Render
- Database: MySQL-compatible provider

Reference docs in repository:

- `DEPLOY_ONE_PAGE_CHECKLIST.md`
- `DEPLOYMENT_VERCEL_RENDER.md`

## Recent UX Improvements

- Chat buttons now show inline progress state: `Establishing chat with owner...`
- Room detail API flow updated to reduce noisy 404 owner-route calls for public viewers
- Homepage stats now animate count-up when entering viewport
- Footer tagline now uses dynamic business tagline from site settings
- Logo rendering has resilient fallback handling across layouts

## Troubleshooting

### Room detail loads but console shows 404 on `/rooms/my-room/:id`

Cause: owner-only endpoint called first for public room view.

Fix: public endpoint is now preferred and owner endpoint is used only as fallback.

### Push notification works only when app is open

Ensure:

- Service worker is registered (`public/sw.js`)
- VAPID env vars are set in backend
- User has granted browser notification permission
- Push subscription exists in backend DB

### Logo icon appears broken sometimes

Ensure site settings logo URL is valid. App now includes resilient fallback to avoid broken image UI.

## Scripts

- `npm run dev` Start frontend dev server
- `npm run build` Type-check and build frontend
- `npm run preview` Preview production build
- `npm run lint` Run ESLint

## License

Private project.
