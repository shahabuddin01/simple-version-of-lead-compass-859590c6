#!/bin/bash
set -e

echo "========================================="
echo "  NS Production CRM — Production Build"
echo "========================================="

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js 18+ is required. Current: $(node -v)"
    exit 1
fi

echo "Installing dependencies..."
npm ci --production=false

echo "Building for production..."
npm run build

echo ""
echo "Build complete! Output is in the /dist folder."
echo ""
echo "To deploy to VPS:"
echo "  rsync -avz --delete dist/ user@yourserver:/var/www/crm/dist/"
echo ""
echo "To deploy to shared hosting:"
echo "  Upload the contents of /dist via FTP to your web root."
echo ""
echo "Don't forget to:"
echo "  1. Set up SSL (Let's Encrypt recommended)"
echo "  2. Copy nginx.conf or .htaccess to your server"
echo "  3. Test login at https://yourdomain.com"
echo "========================================="
