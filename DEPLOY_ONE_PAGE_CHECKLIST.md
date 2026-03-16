# One-Page Quick Execution Checklist (Paste-Only)

## 1) Create Accounts

1. GitHub: https://github.com/signup
2. Vercel: https://vercel.com/signup
3. Render: https://dashboard.render.com/register
4. TiDB Cloud: https://tidbcloud.com/
5. Supabase: https://supabase.com/dashboard/sign-up
6. ImgBB: https://imgbb.com/

## 2) Database Setup (TiDB)

1. Create Serverless cluster
2. Create database: room_rental_db
3. Create DB user/password
4. Run SQL from [backend/database/local.sql](backend/database/local.sql)
5. Copy DB values:

DB_HOST=gateway01.ap-southeast-1.prod.aws.tidbcloud.com
DB_PORT=4000
DB_USER=3kNF6kVq6PbdGsL.root
DB_PASSWORD=3kNF6kVq6PbdGsL.root
DB_NAME=room_rental_db
DB_SSL=
DB_SSL_REJECT_UNAUTHORIZED=

## 3) Supabase Setup

1. Create project
2. Run SQL from [backend/database/supabase.sql](backend/database/supabase.sql)
3. Copy values:

VITE_SUPABASE_URL=https://trljehnepspxbauotxpk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRybGplaG5lcHNweGJhdW90eHBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODg0MjksImV4cCI6MjA4NzY2NDQyOX0.cjrx3mz5SDd6StN-gUU4soTzNhPsVEEA6yrkmZYffRM
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRybGplaG5lcHNweGJhdW90eHBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA4ODQyOSwiZXhwIjoyMDg3NjY0NDI5fQ.LJ9gtEg2XUereBf7F22bA0Acu_dAlnRAiMLbY_ne2B8

## 4) ImgBB Setup

IMAGE_STORAGE_API_KEY=934df5fecfe60ef44e5704ff895f87c6
IMAGE_STORAGE_URL=https://api.imgbb.com/1/upload

## 5) Render Backend Create

1. New -> Web Service -> connect GitHub repo
2. Use values:

Root Directory=backend
Build Command=npm install
Start Command=npm start
Health Check Path=/api/health

## 6) Render Environment Variables (Paste)

NODE_ENV=production
FRONTEND_URL=https://YOUR_VERCEL_DOMAIN.vercel.app
DB_HOST=YOUR_DB_HOST
DB_PORT=3306
DB_USER=YOUR_DB_USER
DB_PASSWORD=YOUR_DB_PASSWORD
DB_NAME=room_rental_db
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true
JWT_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET
JWT_EXPIRES_IN=7d
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY=YOUR_SUPABASE_SERVICE_KEY
IMAGE_STORAGE_API_KEY=YOUR_IMGBB_KEY
IMAGE_STORAGE_URL=https://api.imgbb.com/1/upload
SITE_URL=https://YOUR_VERCEL_DOMAIN.vercel.app
APP_NAME=RoomRental
BUSINESS_TAGLINE=Find Your Perfect Roommate
SUPPORT_PHONE=+91 99999 99999
BUSINESS_ADDRESS=Pune, Maharashtra
DEFAULT_CITY=Pune
MAX_IMAGE_SIZE_KB=500
MAX_IMAGES_PER_ROOM=5
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_REQUESTS=20
PUBLIC_RATE_LIMIT_WINDOW_MS=900000
PUBLIC_RATE_LIMIT_MAX_REQUESTS=300
REQUEST_TIMEOUT_MS=60000
REQUEST_BODY_LIMIT=2mb
TRUST_PROXY=1

## 7) Render Verify

1. Deploy
2. Open:

https://YOUR_RENDER_SERVICE.onrender.com/api/health

## 8) Vercel Frontend Create

1. Add New -> Project -> import same GitHub repo
2. Use values:

Build Command=npm run build
Output Directory=dist

## 9) Vercel Environment Variables (Paste)

VITE_API_URL=https://YOUR_RENDER_SERVICE.onrender.com/api
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_SITE_URL=https://YOUR_VERCEL_DOMAIN.vercel.app
VITE_SITE_BRAND=RoomRental
VITE_DEFAULT_CITY=Pune
VITE_ANALYTICS_ENDPOINT=

## 10) Final Cross-Link

1. Put final Vercel URL into Render FRONTEND_URL
2. Redeploy Render
3. Confirm VITE_API_URL in Vercel points to final Render URL
4. Redeploy Vercel

## 11) Final Smoke Test

1. Open frontend URL
2. Login/Register
3. Rooms list and details
4. Contact form
5. Admin area
6. Image upload
7. Chat/realtime
