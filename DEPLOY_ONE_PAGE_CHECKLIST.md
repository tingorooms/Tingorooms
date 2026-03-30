# Final Start-to-End Deployment Documentation

Single source of truth for production deployment and go-live.

This is the single final document for launch.
Every backend environment variable appears exactly once with:
- where value comes from (dashboard)
- where to set it
- how to verify it

Primary stack:
- Frontend: Vercel
- Backend + Database: Railway (MySQL)
- Realtime: Supabase
- CDN + Image: Cloudflare (R2 + CDN)
- Email: Brevo
- Logs: Better Stack (optional)

---

## Beginner Step-by-Step Setup (Start to End)

Follow sections in exact order. Do not skip steps.

### A) Create All Accounts First (Registration Links)

Create these accounts before any deployment:

1. GitHub (code hosting)
	- Link: https://github.com/signup
	- Click Sign up
	- Verify email
	- Enable 2FA (recommended)

2. Vercel (frontend hosting)
	- Link: https://vercel.com/signup
	- Click Continue with GitHub
	- Authorize Vercel to access your repositories

3. Railway (backend hosting)
	- Link: https://railway.app
	- Click Login with GitHub
	- Authorize Railway

4. Railway (MySQL database + backend hosting)
	- Link: https://railway.app
	- Click Login with GitHub
	- Authorize Railway

5. Supabase (realtime chat)
	- Link: https://supabase.com/dashboard/sign-up
	- Click Continue with GitHub

6. Cloudflare (DNS/CDN + R2 storage)
	- Link: https://dash.cloudflare.com/sign-up
	- Create account

7. Brevo (SMTP email)
	- Link: https://www.brevo.com
	- Click Sign up free
	- Verify email

8. Better Stack (optional logs)
	- Link: https://betterstack.com
	- Create account only if you want remote logs now

### B) Put Project on GitHub

1. Open project folder in terminal:
	- `cd "C:\Users\Magical Events\Downloads\Kimi_Agent_Room Rental Management Plan\app"`
2. Initialize and push:
	- `git init`
	- `git add .`
	- `git commit -m "Initial production setup"`
	- `git branch -M main`
	- `git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git`
	- `git push -u origin main`
3. Confirm code is visible on GitHub.

### C) Create Railway Database

1. Open Railway dashboard (same project as backend).
2. Click New -> Database -> MySQL.
3. Wait for database to provision (2-3 minutes).
4. Open the database service in Railway.
5. Go to Connect tab and save credentials:
	- DB_HOST (host)
	- MYSQL_PASSWORD (password)
	- MYSQL_USER (username)
	- MYSQL_DB (database name)
	- Port (typically 3306)
6. Import schema:
	- In Railway, open SQL tab or use MySQL client.
	- Copy SQL from `backend/database/local.sql` (or your finalized production SQL file).
	- Run SQL and confirm tables exist.

### D) Create Supabase Project (Chat)

1. Open Supabase dashboard.
2. Click New Project.
3. Set name and region.
4. After creation, go to Settings -> API.
5. Save values:
	- Project URL
	- anon key
	- service_role key
6. Open SQL Editor and run `backend/database/supabase.sql`.

### E) Configure Cloudflare R2 (Image Storage)

1. Open Cloudflare dashboard.
2. Go to R2 Object Storage.
3. Create bucket (example: `room-rental-images`).
4. Go to Manage R2 API Tokens.
5. Create token with read/write bucket access.
6. Save values:
	- Account ID
	- Access Key ID
	- Secret Access Key
	- Bucket name
7. Configure public image URL:
	- Create custom domain for bucket or use public R2 URL.
	- Save as `R2_PUBLIC_BASE_URL`.

### F) Configure Brevo SMTP (Email)

1. Open Brevo dashboard.
2. Go to SMTP & API.
3. Open SMTP tab and save:
	- host: `smtp-relay.brevo.com`
	- port: `587`
	- login
	- SMTP password
4. Add sender domain in Brevo:
	- Go to Senders & Domains.
	- Add your domain.
	- Copy SPF and DKIM records shown by Brevo.
5. Add DNS records in Cloudflare DNS.
6. Wait for Brevo verification status.
7. Set backend env flags after verification:
	- `SMTP_SPF_CONFIGURED=true`
	- `SMTP_DKIM_CONFIGURED=true`

### G) Deploy Backend & Database on Railway

1. Open Railway dashboard (https://railway.app).
2. Create a new project (or use existing one).
3. Add services:
   - **MySQL Database**: Click New -> Database -> MySQL (will auto-provision)
   - **Backend**: Click New -> Deploy from GitHub Repo
4. Configure Backend Service:
   - Select this repository
   - Set root directory to `backend`
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/api/health`
5. Copy MySQL connection credentials from database service
6. Open Railway Variables on backend service and add all backend env vars from Section 2 below:
   - DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (from MySQL service)
   - All other env vars (JWT, Supabase, SMTP, R2, etc.)
7. Deploy and wait for success
8. Open backend health URL to verify:
   - `https://YOUR-RAILWAY-DOMAIN/api/health`

### H) Deploy Frontend on Vercel

1. Open Vercel dashboard.
2. Click Add New -> Project.
3. Import same GitHub repo.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add Vercel env vars from Section 3 below.
7. Deploy.
8. After deploy, copy Vercel production URL.
9. Update Railway `FRONTEND_URL` with this final URL if needed.

### I) Configure Domain and CDN (Cloudflare)

1. Add your domain in Cloudflare.
2. Change nameservers at domain registrar to Cloudflare nameservers.
3. Add DNS records:
	- frontend domain/subdomain -> Vercel
	- api subdomain (optional) -> Railway
4. Enable proxy/CDN for production records.
5. Enable SSL/TLS Full (strict) after certificates are active.

### J) Run Startup Self-Check (Required)

1. Open:
	- `https://YOUR-RAILWAY-DOMAIN/api/startup/self-check`
2. If token is enabled, send header:
	- `x-integration-check-token: YOUR_TOKEN`
3. Confirm:
	- `production_ready=true`
	- no failed required checks

### K) Smoke Test (Real User Flow)

1. Register and login
2. Open room list and room detail
3. Upload room images
4. Start chat and send message
5. Submit contact/lead form
6. Verify email delivery in Brevo
7. Confirm no major console or server errors

### L) Move to Checklist Section

Beginner setup is complete.
Now continue to the structured checklist sections below:

- Section 1: dashboard settings
- Section 2: backend env variable mapping
- Section 3: frontend env variables

---

## 1) Dashboard Settings (Non-Env)

### Railway
- [ ] Project connected to GitHub repo
- [ ] Service root directory is backend
- [ ] Build command is npm install
- [ ] Start command is npm start
- [ ] Health check path is /api/health
- [ ] Auto deploy on main branch enabled

### Vercel
- [ ] Project connected to same repo
- [ ] Build command is npm run build
- [ ] Output directory is dist
- [ ] Production domain is active

### Railway Database
- [ ] MySQL database created and provisioned
- [ ] Connection credentials saved (host, user, password, database name)
- [ ] Schema imported successfully
- [ ] Test connection from Railway backend service works

### Supabase
- [ ] Project active
- [ ] SQL from backend/database/supabase.sql applied

### Cloudflare
- [ ] Domain DNS is active
- [ ] CDN proxy enabled for production domain
- [ ] R2 bucket created
- [ ] R2 API token created with read/write to bucket

### Brevo
- [ ] Sender domain added
- [ ] SPF record verified
- [ ] DKIM record verified
- [ ] SMTP credentials generated

### Better Stack (optional)
- [ ] Source/token created for log ingestion

---

## 1.5) Portal Environment Variable Mapping

Use the portal column to know where each backend env var is configured. This is the single reference for which dashboard or service holds the variable.

- Railway (railway.app)
  - DB_HOST
  - DB_PORT
  - DB_USER
  - DB_PASSWORD
  - DB_NAME
  - DB_SSL
  - DB_SSL_REJECT_UNAUTHORIZED
  - JWT_SECRET
  - JWT_EXPIRES_IN
  - BCRYPT_SALT_ROUNDS
  - SUPABASE_URL
  - SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_KEY
  - IMAGE_STORAGE_PROVIDER
  - IMAGE_STORAGE_FALLBACK_TO_IMGBB
  - R2_ACCOUNT_ID
  - R2_ACCESS_KEY_ID
  - R2_SECRET_ACCESS_KEY
  - R2_BUCKET_NAME
  - R2_PUBLIC_BASE_URL
  - IMAGE_STORAGE_API_KEY
  - IMAGE_STORAGE_URL
  - SMTP_HOST
  - SMTP_PORT
  - SMTP_SECURE
  - SMTP_USER
  - SMTP_PASS
  - SMTP_TLS_REJECT_UNAUTHORIZED
  - SMTP_SPF_CONFIGURED
  - SMTP_DKIM_CONFIGURED
  - ADMIN_EMAIL
  - SUPPORT_EMAIL
  - NOTIFICATION_EMAIL
  - VAPID_PUBLIC_KEY
  - VAPID_PRIVATE_KEY
  - VAPID_SUBJECT
  - SITE_URL
  - APP_NAME
  - BUSINESS_TAGLINE
  - BUSINESS_LOGO_URL
  - FAVICON_URL
  - SUPPORT_PHONE
  - BUSINESS_ADDRESS
  - DEFAULT_CITY
  - FACEBOOK_URL
  - TWITTER_URL
  - INSTAGRAM_URL
  - LINKEDIN_URL
  - YOUTUBE_URL
  - DEFAULT_AD_BG_SEARCH_URL
  - DEFAULT_AD_BG_POST_URL
  - MAX_IMAGE_SIZE_KB
  - MAX_IMAGES_PER_ROOM
  - RATE_LIMIT_WINDOW_MS
  - RATE_LIMIT_MAX_REQUESTS
  - AUTH_RATE_LIMIT_WINDOW_MS
  - AUTH_RATE_LIMIT_MAX_REQUESTS
  - PUBLIC_RATE_LIMIT_WINDOW_MS
  - PUBLIC_RATE_LIMIT_MAX_REQUESTS
  - REQUEST_TIMEOUT_MS
  - REQUEST_BODY_LIMIT
  - KEEP_ALIVE_CRON
  - ENABLE_LOG_DRAIN
  - LOGTAIL_SOURCE_TOKEN
  - BETTER_STACK_SOURCE_TOKEN
  - LOGTAIL_INGEST_URL
  - INTEGRATION_CHECK_TOKEN

- Vercel (vercel.com)
  - VITE_API_URL
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_ANON_KEY
  - VITE_SITE_URL

- Supabase (supabase.com)
  - Project URL
  - anon key
  - service_role key

- Cloudflare (dash.cloudflare.com)
  - R2_ACCOUNT_ID
  - R2_ACCESS_KEY_ID
  - R2_SECRET_ACCESS_KEY
  - R2_BUCKET_NAME
  - R2_PUBLIC_BASE_URL

- Brevo (www.brevo.com)
  - SMTP_HOST
  - SMTP_PORT
  - SMTP_SECURE
  - SMTP_USER
  - SMTP_PASS
  - SMTP_SPF_CONFIGURED
  - SMTP_DKIM_CONFIGURED

---

## 2) Backend Environment Variables (Set In Railway Variables)

Set all variables below in Railway service Variables.

### App Runtime and Access

| Env var | Required | Value source (dashboard) | Verify after deploy |
|---|---|---|---|
| NODE_ENV | Yes | Manual fixed value: production | /api/health shows environment=production |
| PORT | Yes | Railway runtime default or manual (10000) | App starts without port bind error |
| FRONTEND_URL | Yes | Vercel project production domain | Browser API calls pass CORS |
| TRUST_PROXY | Yes | Manual fixed value: 1 | Correct client IP and rate limit behavior |

### Database (Railway MySQL)

| Env var | Required | Value source (dashboard) | Verify after deploy |
|---|---|---|---|
| DB_HOST | Yes | Railway -> Database -> Connect -> Host | /api/startup/self-check database_connected=true |
| DB_PORT | Yes | Railway -> Database -> Connect -> Port (usually 3306) | DB connection succeeds |
| DB_USER | Yes | Railway -> Database -> Connect -> MYSQL_USER | DB connection succeeds |
| DB_PASSWORD | Yes | Railway -> Database -> Connect -> MYSQL_PASSWORD | DB connection succeeds |
| DB_NAME | Yes | Railway -> Database -> Connect -> MYSQL_DB | DB queries work |
| DB_SSL | Optional | Manual: false (local network) or true (external) | Connection works without errors |
| DB_SSL_REJECT_UNAUTHORIZED | Optional | Manual: false (for Railway) | Connection succeeds |

### Authentication

| Env var | Required | Value source (dashboard) | Verify after deploy |
|---|---|---|---|
| JWT_SECRET | Yes | Generate strong random secret (password manager) | Login + token auth works |
| JWT_EXPIRES_IN | Yes | Manual fixed value: 7d (or business policy) | Token expiration behavior is correct |
| BCRYPT_SALT_ROUNDS | Yes | Manual fixed value: 12 | Register/login performance acceptable |

### Supabase Realtime

| Env var | Required | Value source (dashboard) | Verify after deploy |
|---|---|---|---|
| SUPABASE_URL | Yes | Supabase -> Settings -> API -> Project URL | /api/startup/self-check supabase_realtime=true |
| SUPABASE_ANON_KEY | Yes | Supabase -> Settings -> API -> anon key | Realtime chat connects |
| SUPABASE_SERVICE_KEY | Yes | Supabase -> Settings -> API -> service_role key | Admin chat operations work |

### Image Storage Provider Selection

| Env var | Required | Value source (dashboard) | Verify after deploy |
|---|---|---|---|
| IMAGE_STORAGE_PROVIDER | Yes | Manual: r2 (recommended) or imgbb | /api/startup/self-check image_storage=true |
| IMAGE_STORAGE_FALLBACK_TO_IMGBB | Optional | Manual true/false | Fallback behavior matches policy |

### Cloudflare R2 (Required when IMAGE_STORAGE_PROVIDER=r2)

| Env var | Required | Value source (dashboard) | Verify after deploy |
|---|---|---|---|
| R2_ACCOUNT_ID | Conditional | Cloudflare -> Account -> Account ID | R2 upload succeeds |
| R2_ACCESS_KEY_ID | Conditional | Cloudflare -> R2 -> API Tokens | R2 upload succeeds |
| R2_SECRET_ACCESS_KEY | Conditional | Cloudflare -> R2 -> API Tokens | R2 upload succeeds |
| R2_BUCKET_NAME | Conditional | Cloudflare -> R2 -> Bucket name | Images stored in correct bucket |
| R2_PUBLIC_BASE_URL | Conditional | Cloudflare custom domain/public URL for bucket | Uploaded image URLs open publicly |

### ImgBB (Required when IMAGE_STORAGE_PROVIDER=imgbb, optional fallback for r2)

| Env var | Required | Value source (dashboard) | Verify after deploy |
|---|---|---|---|
| IMAGE_STORAGE_API_KEY | Conditional | ImgBB account/API page | Image upload succeeds |
| IMAGE_STORAGE_URL | Conditional | Manual fixed value: https://api.imgbb.com/1/upload | Upload requests return 200 |

### Email (Brevo SMTP)

| Env var | Required | Value source (dashboard) | Verify after deploy |
|---|---|---|---|
| SMTP_HOST | Yes | Manual fixed value: smtp-relay.brevo.com | /api/startup/self-check email_brevo_smtp=true |
| SMTP_PORT | Yes | Brevo SMTP docs (587) | Email send succeeds |
| SMTP_SECURE | Yes | Manual fixed value: false (for 587) | SMTP handshake succeeds |
| SMTP_USER | Yes | Brevo -> SMTP credentials login | Email send succeeds |
| SMTP_PASS | Yes | Brevo -> SMTP credentials password | Email send succeeds |
| SMTP_TLS_REJECT_UNAUTHORIZED | Yes | Manual fixed value: true | TLS cert validation passes |
| SMTP_SPF_CONFIGURED | Yes | Manual true after DNS SPF verified in Brevo | /api/startup/self-check email_spf_configured=true |
| SMTP_DKIM_CONFIGURED | Yes | Manual true after DNS DKIM verified in Brevo | /api/startup/self-check email_dkim_configured=true |
| ADMIN_EMAIL | Yes | Business mailbox | Admin notifications received |
| SUPPORT_EMAIL | Yes | Support mailbox | User support mails route correctly |
| NOTIFICATION_EMAIL | Yes | Sender mailbox/domain verified in Brevo | Outgoing system mails delivered |

### Web Push Notifications

| Env var | Required | Value source (dashboard) | Verify after deploy |
|---|---|---|---|
| VAPID_PUBLIC_KEY | Recommended | Generate VAPID key pair | Browser subscription works |
| VAPID_PRIVATE_KEY | Recommended | Generate VAPID key pair | Push send works |
| VAPID_SUBJECT | Recommended | Manual mailto value | Push library initializes |

### Site Branding and Public Links

| Env var | Required | Value source (dashboard) | Verify after deploy |
|---|---|---|---|
| SITE_URL | Yes | Vercel production domain (or custom domain) | Public links in mails are correct |
| APP_NAME | Yes | Business brand name | UI/emails use correct brand |
| BUSINESS_TAGLINE | Optional | Marketing text | Site settings show updated tagline |
| BUSINESS_LOGO_URL | Optional | Public CDN/logo URL | Branding logo loads |
| FAVICON_URL | Optional | Public favicon URL | Browser tab icon loads |
| SUPPORT_PHONE | Optional | Business support number | Contact sections show correct number |
| BUSINESS_ADDRESS | Optional | Business address | Footer/contact shows correct address |
| DEFAULT_CITY | Optional | Main launch city | Default filters/location correct |
| FACEBOOK_URL | Optional | Brand social URL | Footer social link valid |
| TWITTER_URL | Optional | Brand social URL | Footer social link valid |
| INSTAGRAM_URL | Optional | Brand social URL | Footer social link valid |
| LINKEDIN_URL | Optional | Brand social URL | Footer social link valid |
| YOUTUBE_URL | Optional | Brand social URL | Footer social link valid |
| DEFAULT_AD_BG_SEARCH_URL | Optional | Public image URL | Search ad background loads |
| DEFAULT_AD_BG_POST_URL | Optional | Public image URL | Post ad background loads |

### Security and Rate Limits

| Env var | Required | Value source (dashboard) | Verify after deploy |
|---|---|---|---|
| MAX_IMAGE_SIZE_KB | Yes | Manual policy value (example 500) | Oversized upload blocked properly |
| MAX_IMAGES_PER_ROOM | Yes | Manual policy value (example 5) | Excess file count blocked properly |
| RATE_LIMIT_WINDOW_MS | Yes | Manual policy value | Global rate limit works |
| RATE_LIMIT_MAX_REQUESTS | Yes | Manual policy value | Global rate limit works |
| AUTH_RATE_LIMIT_WINDOW_MS | Yes | Manual policy value | Auth endpoint rate limit works |
| AUTH_RATE_LIMIT_MAX_REQUESTS | Yes | Manual policy value | Auth endpoint rate limit works |
| PUBLIC_RATE_LIMIT_WINDOW_MS | Yes | Manual policy value | Public endpoint throttling works |
| PUBLIC_RATE_LIMIT_MAX_REQUESTS | Yes | Manual policy value | Public endpoint throttling works |
| REQUEST_TIMEOUT_MS | Yes | Manual policy value | Long requests terminate safely |
| REQUEST_BODY_LIMIT | Yes | Manual policy value (example 2mb) | Large payload rejected safely |

### Schedulers, Logging, and Ops

| Env var | Required | Value source (dashboard) | Verify after deploy |
|---|---|---|---|
| KEEP_ALIVE_CRON | Recommended | Manual cron value (example 15 3 * * *) | Startup self-check shows keep-alive cron |
| ENABLE_LOG_DRAIN | Optional | Manual true/false | Logs appear in Better Stack when true |
| LOGTAIL_SOURCE_TOKEN | Conditional | Better Stack source token | Remote logs accepted |
| BETTER_STACK_SOURCE_TOKEN | Conditional | Better Stack source token alias | Remote logs accepted |
| LOGTAIL_INGEST_URL | Conditional | Better Stack ingest URL | Remote logs accepted |
| INTEGRATION_CHECK_TOKEN | Recommended | Generate secret token | /api/startup/self-check gated externally |

---

## 3) Frontend Variables Needed to Support Backend (Set In Vercel)

These are not backend vars, but backend readiness depends on them.

- [ ] VITE_API_URL = https://YOUR-RAILWAY-DOMAIN/api
- [ ] VITE_SUPABASE_URL = Supabase Project URL
- [ ] VITE_SUPABASE_ANON_KEY = Supabase anon key
- [ ] VITE_SITE_URL = your Vercel/custom domain

---

## 4) Final Go-Live Check (No Duplicate Steps)

Use this only as final confirmation after completing Beginner sections J and K.

- [ ] `/api/health` is healthy
- [ ] `/api/startup/self-check` returns `production_ready=true`
- [ ] End-to-end smoke test passed (login, room flow, image upload, chat, contact email)
- [ ] Brevo delivery is successful and SPF/DKIM are marked true
- [ ] Optional: Better Stack receives logs when enabled

---

## 5) Emergency Rollback Checklist

- [ ] Keep previous Railway deployment ready to redeploy
- [ ] Keep previous Vercel deployment ready to promote
- [ ] Keep DB credentials unchanged during app rollback
- [ ] Disable new risky flags only (log drain, fallback toggles) before full rollback

If all items in sections 1, 2, 3, and 4 pass, production launch is ready.
