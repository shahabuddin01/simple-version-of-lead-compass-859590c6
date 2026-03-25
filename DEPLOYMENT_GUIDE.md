# NH Production House CRM — Deployment Guide

## Server Requirements
- **PHP**: 8.0+ with PDO MySQL extension
- **MySQL**: 5.7+ or MariaDB 10.3+
- **Node.js**: 18+ (for building only — the output is static HTML/CSS/JS)
- **RAM**: Minimum 1GB (for build process)
- **Disk**: ~100MB for the built application
- **Web Server**: Apache (cPanel) recommended

---

## Step 1: Configure Frontend Environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and set your domain:

```env
VITE_APP_URL=https://yourdomain.com
VITE_API_URL=https://yourdomain.com
VITE_MILLIONVERIFIER_API_KEY=your_millionverifier_key
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

---

## Step 2: Build Frontend for Production

```bash
npm ci
npm run build
```

The production-ready files will be in the `dist/` folder.

---

## Step 3: Set Up MySQL Database on cPanel

1. Log in to **cPanel**
2. Go to **MySQL Databases**
3. Create a new database: `yourname_crm`
4. Create a database user with a strong password
5. Add the user to the database with **ALL PRIVILEGES**
6. Open **phpMyAdmin**
7. Select your new database
8. Click **Import** → upload `/backend/database/schema.sql`
9. All tables will be created automatically with default admin user

---

## Step 4: Configure Backend

1. Copy `backend/config/.env.example` to `backend/config/.env`
2. Edit with your cPanel database credentials:

```env
DB_HOST=localhost
DB_NAME=yourname_crm
DB_USER=yourname_crmuser
DB_PASS=your_strong_password
APP_URL=https://yourdomain.com
JWT_SECRET=generate_a_random_64_char_string
```

---

## Step 5: Upload Files to cPanel

### Via File Manager or FTP:

1. Upload contents of `dist/` to `public_html/`
2. Upload the `backend/` folder to `public_html/backend/`
3. Upload the root `.htaccess` to `public_html/`
4. Ensure `backend/config/.env` has correct credentials

### File structure on server:
```
public_html/
├── index.html          (from dist/)
├── assets/             (from dist/)
├── .htaccess           (from project root)
├── backend/
│   ├── index.php       (API router)
│   ├── .htaccess       (API rewrite rules)
│   ├── config/
│   │   ├── database.php
│   │   └── .env        (YOUR credentials - not in git!)
│   ├── middleware/
│   │   ├── auth.php
│   │   └── cors.php
│   ├── api/
│   │   ├── auth/
│   │   ├── leads/
│   │   ├── users/
│   │   ├── backup/
│   │   ├── verify/
│   │   ├── settings/
│   │   └── security/
│   └── database/
│       └── schema.sql
```

---

## Step 6: Verify Installation

1. Visit `https://yourdomain.com/backend/api/health`
   - Should return: `{"status":"ok","service":"NH Production House CRM API"}`
2. Visit `https://yourdomain.com`
   - Should show the login page
3. Login with default admin credentials (see below)

---

## Default Login Credentials

| Role     | Email                          | Password     |
|----------|--------------------------------|--------------|
| Admin    | admin@nhproductionhouse.com    | Admin@1234   |
| Manager  | manager@nhproductionhouse.com  | Manager@1234 |
| Employee | employee@nhproductionhouse.com | Employee@1234|
| Viewer   | viewer@nhproductionhouse.com   | Viewer@1234  |

> **Important**: Change these passwords immediately after first login in production.

---

## Optional: Set Up Cron Jobs

In cPanel → **Cron Jobs**, add:

### Weekly Backup (Sundays at midnight):
```
0 0 * * 0 curl -s -X POST https://yourdomain.com/backend/api/backup -H "Authorization: Bearer YOUR_ADMIN_TOKEN" > /dev/null
```

### Clean Expired Sessions (daily at 3am):
```
0 3 * * * curl -s https://yourdomain.com/backend/api/auth/cleanup > /dev/null
```

---

## Section: Change Domain — Checklist

Every time you change your hosting domain:

- [ ] Update `VITE_APP_URL` and `VITE_API_URL` in `.env`
- [ ] Update `APP_URL` in `backend/config/.env`
- [ ] Run `npm run build`
- [ ] Upload new `dist/` to server
- [ ] Update allowed origins in API Dashboard → Internal APIs
- [ ] Update any external tools pointing to old domain
- [ ] Test login, password reset, and API calls

---

## Security Features Included

| Feature | Status |
|---------|--------|
| Session-based auth (8h max, 60min idle timeout) | ✅ |
| Session expiry warning (5 min before timeout) | ✅ |
| Concurrent session detection | ✅ |
| Brute-force protection (5 attempts → 24h IP block) | ✅ |
| Role-based access control (Admin/Manager/Employee/Viewer) | ✅ |
| Admin-only sidebar sections | ✅ |
| Input sanitization (XSS prevention) | ✅ |
| Full audit logging | ✅ |
| Security headers (Apache .htaccess) | ✅ |
| Production console.log stripping | ✅ |
| Error boundary (graceful crash handling) | ✅ |
| PHP prepared statements (SQL injection prevention) | ✅ |
| CORS protection | ✅ |
| Password hashing (bcrypt) | ✅ |

---

## Security Headers

The `.htaccess` files include these security headers:

- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — controls referrer info
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — disables device APIs
- `Strict-Transport-Security: max-age=31536000` — enforces HTTPS

---

## Build Optimizations

The production build includes:
- **Terser minification** with console.log removal
- **Vendor chunking** (React, UI components, charts, motion in separate bundles)
- **Hidden source maps** (for error monitoring, not publicly accessible)
- **Tree-shaking** (unused code eliminated)
- **Gzip compression** (configured in Apache .htaccess)
- **Aggressive caching** for static assets (1 year), no-cache for index.html

---

## Architecture Overview

```
┌─────────────────────────────┐
│  Frontend (React + Vite)    │  → public_html/
│  Static HTML/CSS/JS         │
│  Hosted on cPanel           │
└────────────┬────────────────┘
             │ HTTP API calls
             ▼
┌─────────────────────────────┐
│  PHP REST API               │  → public_html/backend/
│  Routes, Auth, CRUD         │
│  Runs on Apache + PHP 8+   │
└────────────┬────────────────┘
             │ PDO MySQL
             ▼
┌─────────────────────────────┐
│  MySQL Database             │  → cPanel MySQL
│  All CRM data               │
│  Managed via phpMyAdmin     │
└─────────────────────────────┘
```

No third-party services required. Everything runs on your cPanel hosting.
