# NH Production House — Edge Functions Setup Guide

This guide covers deploying the backup Edge Functions and configuring all required secrets.

---

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- A Supabase project linked: `npx supabase link --project-ref YOUR_PROJECT_REF`
- Node.js 18+ installed

---

## 1. Deploy Edge Functions

```bash
npx supabase functions deploy send-backup-email
npx supabase functions deploy backup-to-gdrive
npx supabase functions deploy scheduled-backup
```

---

## 2. Set Edge Function Secrets

### SMTP (for email backups)

```bash
npx supabase secrets set SMTP_HOST=smtp.gmail.com
npx supabase secrets set SMTP_PORT=587
npx supabase secrets set SMTP_USER=you@gmail.com
npx supabase secrets set SMTP_PASS=your_app_password
npx supabase secrets set SMTP_FROM_NAME="NH Production House"
```

> **Gmail users:** Use an [App Password](https://myaccount.google.com/apppasswords), not your regular password.

### Google Drive (for Drive backups)

```bash
npx supabase secrets set GOOGLE_CLIENT_ID=your_client_id
npx supabase secrets set GOOGLE_CLIENT_SECRET=your_client_secret
npx supabase secrets set GOOGLE_REFRESH_TOKEN=your_refresh_token
```

---

## 3. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Go to **APIs & Services → Library**
4. Search for **Google Drive API** → Enable it
5. Go to **APIs & Services → Credentials**
6. Click **Create Credentials → OAuth 2.0 Client ID**
7. Application type: **Web application**
8. Add **Authorized JavaScript origins**:
   - `https://YOUR-PROJECT-REF.supabase.co`
   - Your app domain (the value of `VITE_APP_URL` in your `.env`)
9. Add **Authorized redirect URIs**:
   - `https://YOUR_APP_DOMAIN/auth/google-drive/callback`
10. Copy the **Client ID** and **Client Secret**

### Get a Refresh Token

Use the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/):

1. Click the gear icon → Check **"Use your own OAuth credentials"**
2. Enter your Client ID and Client Secret
3. In Step 1, select **Drive API v3 → `https://www.googleapis.com/auth/drive.file`**
4. Click **Authorize APIs** → Sign in with your Google account
5. Click **Exchange authorization code for tokens**
6. Copy the **Refresh Token**

Then set it:
```bash
npx supabase secrets set GOOGLE_REFRESH_TOKEN=your_refresh_token
```

---

## 4. Enable Scheduled Weekly Backup (pg_cron)

### Enable the extension

1. Go to **Supabase Dashboard → Database → Extensions**
2. Search for `pg_cron` and enable it
3. Also enable `pg_net` if not already enabled

### Create the cron job

Run this SQL in the Supabase SQL Editor:

```sql
-- Create backup_logs table if not exists
CREATE TABLE IF NOT EXISTS backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  file_size_kb INTEGER,
  record_count INTEGER,
  status TEXT DEFAULT 'success',
  backup_data JSONB
);

-- Enable RLS
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only policy (adjust based on your auth setup)
CREATE POLICY "Admin only backup access"
  ON backup_logs FOR ALL
  TO authenticated
  USING (true);

-- Schedule weekly backup: Every Sunday at 00:00 UTC
SELECT cron.schedule(
  'weekly-crm-backup',
  '0 0 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/scheduled-backup',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )
  $$
);
```

> **Replace** `YOUR-PROJECT-REF` and `YOUR_SERVICE_ROLE_KEY` with your actual values.
> Find your service role key in **Supabase Dashboard → Settings → API**.

### Verify the cron job

```sql
SELECT * FROM cron.job WHERE jobname = 'weekly-crm-backup';
```

---

## 5. Frontend Environment Variables

Add to your `.env` file:

```env
VITE_APP_URL=https://your-domain.com
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_MILLIONVERIFIER_API_KEY=your_millionverifier_key
```

> **Important:** Never hardcode any domain in source code. Always use `VITE_APP_URL`.

---

## 6. Testing

### Test email backup manually
In the CRM → Settings → Backups → Email Backup card → Click "Send Test Backup Now"

### Test Google Drive upload manually
In the CRM → Settings → Backups → Google Drive card → Click "Test Upload Now"

### Test scheduled backup
```bash
curl -X POST https://YOUR-PROJECT-REF.supabase.co/functions/v1/scheduled-backup \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

---

## Architecture Overview

```
┌─────────────────────┐
│   Frontend (React)   │
│   BackupSettings.tsx │
└──────────┬──────────┘
           │ POST
           ▼
┌─────────────────────────────┐
│  scheduled-backup           │  ← Also triggered by pg_cron weekly
│  (Edge Function)            │
│                             │
│  1. Fetch leads, profiles   │
│  2. Save to backup_logs     │
│  3. Call send-backup-email  │
│  4. Call backup-to-gdrive   │
└──────┬──────────┬───────────┘
       │          │
       ▼          ▼
┌────────────┐ ┌────────────────┐
│ send-backup│ │ backup-to-     │
│ -email     │ │ gdrive         │
│ (SMTP)     │ │ (Drive API v3) │
└────────────┘ └────────────────┘
```
