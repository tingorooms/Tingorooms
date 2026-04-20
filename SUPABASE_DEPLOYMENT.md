# Supabase Deployment Instructions

## Your Supabase Credentials

**Project URL:** https://wfkgoowyb.supabase.co
**Project Reference:** wfkgoowyb
**Publishable Key:** sb_publishable_aAHplmR2d3u6jxgTo6tZNA_3qEg-9TH

## Quick Deploy (2 minutes)

### Step 1: Open Supabase SQL Editor
👉 Go to: https://wfkgoowyb.supabase.co/dashboard/sql/new

### Step 2: Copy the Schema
- Open file: `backend/database/supabase.sql`
- Copy **ALL** content (entire file)

### Step 3: Paste in Supabase
- In the SQL editor, paste the content
- Click **"RUN"** button

### Step 4: Verify
- Wait for "Success" message
- Check that all 4 tables are created:
  - ✅ users
  - ✅ rooms
  - ✅ chat_rooms
  - ✅ messages

---

## What Gets Created

**Tables (4):**
- `users` - User profiles for chat
- `rooms` - Room info for chat context
- `chat_rooms` - Chat room metadata
- `messages` - Actual messages

**Functions (3):**
- `update_last_message_at()` - Auto-updates chat timestamp
- `mark_messages_as_read()` - Mark messages as read
- `get_unread_count()` - Count unread messages

**Indexes (16):**
- Performance optimizations for fast queries

**Triggers (1):**
- Auto-updates `last_message_at` on new messages

**Realtime (✅ Enabled):**
- Messages sync instantly
- Chat rooms update in real-time

---

## Environment Variables for Backend

Once deployed, add these to Railway backend:

```
VITE_SUPABASE_URL=https://wfkgoowyb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indma2dvb3d5YmdxZXF4cHdta3R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc3NDUsImV4cCI6MjA4OTg5Mzc0NX0.G_xLQ2yvDTB0TomliNI1zh0qjgBJqzwCNk_ZfRSjMRM
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indma2dvb3d5YmdxZXF4cHdta3R0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDMxNzc0NSwiZXhwIjoyMDg5ODkzNzQ1fQ.6uT8fBQ3dN6dY6PWvMTEeiGMzHJ4QFvlEUZtWClNCWo
```

---

## Troubleshooting

**Issue: "Table already exists"**
- This is OK! Run the script anyway - it will DROP old tables first

**Issue: "Permission denied"**
- Make sure you're using the Service Role key (not Anon key)

**Issue: No realtime updates**
- Go to Supabase Dashboard → Settings → Realtime
- Ensure `messages` and `chat_rooms` tables are enabled

---

## Timeline

- ⏱️ SQL execution: ~2-5 seconds
- ✅ Realtime enabled: Instant
- 🚀 Ready to chat: Immediately after deploy

---

📌 **Status: READY FOR DEPLOYMENT**
- Railway MySQL: ✅ DEPLOYED
- Supabase Schema: ⏳ PENDING (awaiting your deployment)
- Environment Variables: ⏳ PENDING

Next: Deploy schema, then configure Railway backend service!
