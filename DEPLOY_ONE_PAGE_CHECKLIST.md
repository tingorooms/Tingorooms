# Final Start-to-End Deployment Documentation

Single source of truth for production deployment and go-live.

This is the single final document for launch.
Every backend environment variable appears exactly once with:
- where value comes from (dashboard)
- where to set it
- how to verify it

Primary stack:
- Frontend: Vercel
- Backend: Railway
- Database: Planetscale
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

4. Planetscale (MySQL database)
	- Link: https://app.planetscale.com
	- Create account
	- Verify email

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

### C) Create Planetscale Database

1. Open Planetscale dashboard.
2. Click Create database.
3. Database name: `room-rental-db`.
4. Choose nearest region to users.
5. Open Connect and create password.
6. Save credentials:
	- host
	- username
	- password
	- database name
	- port
7. Import schema:
	- Open SQL console in Planetscale.
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

### G) Deploy Backend on Railway

1. Open Railway dashboard.
2. Click New Project -> Deploy from GitHub Repo.
3. Select this repository.
4. Set root directory to `backend`.
5. Build command: `npm install`.
6. Start command: `npm start`.
7. Health check path: `/api/health`.
8. Open Railway Variables and add all backend env vars from Section 2 below.
9. Deploy and wait for success.
10. Open backend health URL:
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

### Planetscale
- [ ] Production database exists
- [ ] Network access allows Railway egress
- [ ] Schema imported successfully

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

## 2) Backend Environment Variables (Set In Railway Variables)

Set all variables below in Railway service Variables.

### App Runtime and Access

| Env var | Required | Value source (dashboard) | Verify after deploy |
|---|---|---|---|
| NODE_ENV | Yes | Manual fixed value: production | /api/health shows environment=production |
| PORT | Yes | Railway runtime default or manual (10000) | App starts without port bind error |
| FRONTEND_URL | Yes | Vercel project production domain | Browser API calls pass CORS |
| TRUST_PROXY | Yes | Manual fixed value: 1 | Correct client IP and rate limit behavior |

### Database (Planetscale)

| Env var | Required | Value source (dashboard) | Verify after deploy |
|---|---|---|---|
| DB_HOST | Yes | Planetscale -> Connect -> host | /api/startup/self-check database_connected=true |
| DB_PORT | Yes | Planetscale -> Connect -> port | DB connection succeeds |
| DB_USER | Yes | Planetscale -> Connect -> username | DB connection succeeds |
| DB_PASSWORD | Yes | Planetscale -> Connect -> password | DB connection succeeds |
| DB_NAME | Yes | Planetscale -> database name | DB queries work |
| DB_SSL | Yes | Manual for Planetscale: true | TLS used to DB |
| DB_SSL_REJECT_UNAUTHORIZED | Yes | Manual: true | DB TLS validation succeeds |

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
