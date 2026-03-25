# NH Production House CRM — Setup Guide

## cPanel Deployment

### Prerequisites
- cPanel hosting with PHP 8.0+ and MySQL
- Node.js 18+ (for building frontend)

### Step 1 — Database Setup
1. In cPanel → MySQL Databases, create a new database
2. Create a database user and assign it to the database with ALL PRIVILEGES
3. Import `backend/database/schema.sql` via phpMyAdmin

### Step 2 — Backend Configuration
1. Copy `backend/config/.env.example` to `backend/config/.env`
2. Fill in your database credentials:
```
DB_HOST=localhost
DB_NAME=your_cpanel_db_name
DB_USER=your_cpanel_db_user
DB_PASS=your_cpanel_db_password
APP_URL=https://yourdomain.com
MILLIONVERIFIER_API_KEY=your_key_here
```

### Step 3 — Create Admin User
1. Visit `https://yourdomain.com/backend/database/setup.php`
2. This creates the default admin account
3. **DELETE `setup.php` immediately after use!**

### Step 4 — Build Frontend
```bash
npm install
npm run build
```
Upload the contents of `dist/` to your `public_html/` directory.

### Step 5 — Upload Backend
Upload the `backend/` folder to `public_html/backend/`.

### Step 6 — Environment Variables
Create `.env` in `public_html/` root:
```
VITE_APP_URL=https://yourdomain.com
VITE_API_URL=https://yourdomain.com
```

### Default Login
- **Email:** admin@shortcaptionbangla.com
- **Password:** Admin@NH2024!
- ⚠️ Change password immediately after first login!
