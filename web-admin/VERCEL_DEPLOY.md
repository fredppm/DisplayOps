# Web Admin Vercel Deployment

This guide explains how to deploy the web-admin to Vercel.

## Initial Setup

### Option 1: Direct Deploy (CLI) - No GitHub Required

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy from web-admin directory**
   ```bash
   cd web-admin
   vercel
   ```

4. **Follow prompts**
   - Link to existing project? `N` (for first deploy)
   - Project name: `office-tv-admin` 
   - Directory: `./` (current directory)
   - Settings detected correctly? `Y`

### Option 2: GitHub Integration (Traditional)

1. **Connect repository to Vercel**
   - Access [vercel.com](https://vercel.com)
   - Import the GitHub repository
   - Select `web-admin` directory as root directory

2. **Project Settings**
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next` (automatic)
   - Install Command: `npm install`
   - Root Directory: `web-admin`

## Environment Variables

Configure the following environment variables in Vercel dashboard:

### Required
```
JWT_SECRET=your-super-secure-jwt-secret-here

# PostgreSQL Database (required for production)
POSTGRES_HOST=your-postgres-host
POSTGRES_PORT=5432
POSTGRES_DB=office_tv_admin
POSTGRES_USER=your-postgres-user
POSTGRES_PASSWORD=your-postgres-password
```

### Optional (with default values)
```
DATABASE_TYPE=postgres
GRPC_CONTROLLER_ADMIN_ENABLED=true
GRPC_CONTROLLER_ADMIN_PORT=50052
ADMIN_SERVER_HOST=0.0.0.0
ADMIN_SERVER_PORT=3000
LOG_LEVEL=warn
```

## Configuration Files

### vercel.json
Main deployment configuration:
- API functions timeout: 30s
- CORS headers configured
- Rewrites for admin routes

### next.config.js
Modifications made:
- `output: 'standalone'` for optimization
- `trailingSlash: false` for clean URLs

### .env.production
Production optimized settings:
- Minimized logs
- Localhost discovery disabled
- HOST configured to 0.0.0.0

## Deployment Process

### CLI Deployment (Direct)

1. **Deploy to production**
   ```bash
   cd web-admin
   vercel --prod
   ```

2. **Set environment variables** (first time only)
   ```bash
   vercel env add JWT_SECRET
   vercel env add POSTGRES_HOST
   vercel env add POSTGRES_PASSWORD
   # ... add all required variables
   ```

3. **Subsequent deployments**
   ```bash
   vercel --prod
   ```

### GitHub Deployment (Automatic)

1. **Push to repository**
   ```bash
   git add .
   git commit -m "feat: Configure Vercel deploy"
   git push origin main
   ```

2. **Automatic deployment**
   - Vercel automatically detects changes
   - Build runs using Next.js
   - Deployment happens automatically

### Verification

1. **Access the URL** provided by Vercel
2. **Test login** with configured credentials
3. **Check APIs** at `/api/health`

## Vercel Limitations

### Features that may not work:
- **gRPC Server**: Limitations in persistent connections between admin and controllers
- **Local network connections**: Controllers need to access admin via internet

### Solutions implemented:
1. **For Storage**: PostgreSQL database replaces JSON file storage
2. **For gRPC**: Controllers must connect via Vercel's public URL
3. **For local network**: Configure firewall/NAT to allow external access

### Database Setup:
1. **Create PostgreSQL database** (recommend: Neon, Supabase, or Railway)
2. **Run migration**: `npm run migrate:db` (locally with DB credentials)
3. **Configure Vercel**: Add PostgreSQL environment variables

## Monitoring

- **Logs**: Available in Vercel dashboard
- **Performance**: Integrated analytics
- **Errors**: Automatic email alerts

## Useful Commands

### CLI Deployment Commands
```bash
# First time setup
npm install -g vercel
vercel login

# Deploy to preview
cd web-admin
vercel

# Deploy to production
vercel --prod

# View deployments
vercel ls

# View real-time logs
vercel logs [deployment-url]

# Environment variables
vercel env add VARIABLE_NAME
vercel env ls
vercel env rm VARIABLE_NAME

# Domain management
vercel domains ls
vercel domains add your-domain.com
```

### Advantages of CLI Deployment
- ✅ **No GitHub required** - Deploy directly from your machine
- ✅ **Faster setup** - No repository connection needed
- ✅ **Full control** - Manual deployment triggers
- ✅ **Same features** - All Vercel features available
- ✅ **Easy rollback** - `vercel rollback` command available