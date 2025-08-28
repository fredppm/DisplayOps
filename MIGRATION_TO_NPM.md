# Migration to NPM-based Development

## Changes Made

### ✅ Created Root Package.json

- Added a unified `package.json` at the project root
- Configured workspaces for both `host-agent` and `web-controller`
- Added comprehensive npm scripts for development and production

### ✅ Removed Old Scripts

- Deleted `scripts/start-dev.bat`
- Deleted `scripts/start-dev.sh`
- These are no longer needed with the new npm-based approach

### ✅ New Development Workflow

**From the project root:**

```bash
# One-time setup (install all dependencies)
npm run install:all

# Start development environment
npm run dev
```

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install dependencies for both services |
| `npm run dev` | Start both services in development mode |
| `npm run dev:web` | Start only web-controller |
| `npm run dev:host` | Start only host-agent |
| `npm run build` | Build both services for production |
| `npm run start` | Start both services in production mode |
| `npm run lint` | Run linting on both services |
| `npm run clean` | Clean build artifacts and node_modules |

### Benefits

1. **Simplified Setup**: Single command to install and run everything
2. **Consistent Experience**: Works the same on Windows, Mac, and Linux
3. **Better Output**: Colored output with service names for easier debugging
4. **Standard Workflow**: Uses standard npm conventions
5. **Easier Maintenance**: No need to maintain separate shell scripts

### Technical Details

- Uses `concurrently` to run both services simultaneously
- Colored output with prefixes: `WEB` (blue) and `HOST` (green)
- Workspace configuration for better dependency management
- Individual service scripts still available for granular control

### Services

- **Web Controller**: http://localhost:3000
- **Host Agent API**: http://localhost:8080

### Migration Steps for Existing Developers

1. **Pull latest changes**
2. **Run from root directory**: `npm run install:all`
3. **Start development**: `npm run dev`
4. **Remove any local copies** of the old `start-dev.*` scripts if bookmarked
