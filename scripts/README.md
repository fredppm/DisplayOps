# Scripts Directory

## Development Setup

The old `start-dev.bat` and `start-dev.sh` scripts have been replaced with a unified npm-based approach.

### Quick Start

From the **root directory** of the project:

```bash
# Install all dependencies for both services
npm install

# Start both services in development mode
npm run dev
```

### Available Commands

- `npm run dev` - Start both web-controller and host-agent in development mode
- `npm run dev:web` - Start only the web-controller (NextJS)
- `npm run dev:host` - Start only the host-agent (Electron)
- `npm run build` - Build both services for production
- `npm run start` - Start both services in production mode
- `npm run lint` - Run linting on both services

### Services

- **Web Controller**: http://localhost:3000
- **Host Agent API**: http://localhost:8080

The development environment will automatically:
1. Install dependencies for both services
2. Start both services concurrently with colored output
3. Watch for changes and restart as needed
