#!/usr/bin/env node

/**
 * DisplayOps Web Controller - Standalone Server
 * This file is used when running the web controller as a service
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

// Environment configuration
const isDev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT, 10) || 3000;

// Initialize Next.js app
const app = next({ 
  dev: isDev,
  hostname,
  port,
  dir: __dirname  // Use current directory as Next.js app directory
});

const handle = app.getRequestHandler();

// Logging function
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const levelTag = level.toUpperCase().padStart(5);
  console.log(`${timestamp} [${levelTag}] ${message}`);
}

// Error handling
process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.message}`, 'error');
  log(error.stack, 'error');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'error');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  log('Received SIGINT, shutting down gracefully...', 'info');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down gracefully...', 'info');
  process.exit(0);
});

async function startServer() {
  try {
    log('Starting DisplayOps Web Controller...', 'info');
    log(`Environment: ${isDev ? 'development' : 'production'}`, 'info');
    log(`Hostname: ${hostname}`, 'info');
    log(`Port: ${port}`, 'info');
    
    // Prepare Next.js app
    log('Preparing Next.js application...', 'info');
    await app.prepare();
    
    // Create HTTP server
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (error) {
        log(`Request error: ${error.message}`, 'error');
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        log(`Port ${port} is already in use`, 'error');
        process.exit(1);
      } else {
        log(`Server error: ${error.message}`, 'error');
        throw error;
      }
    });
    
    // Start listening
    server.listen(port, hostname, () => {
      log('DisplayOps Web Controller started successfully!', 'info');
      log(`🌐 Server running at http://${hostname}:${port}/`, 'info');
      log(`📊 Ready to manage DisplayOps hosts`, 'info');
      
      // Log memory usage
      const usage = process.memoryUsage();
      log(`Memory usage: ${Math.round(usage.heapUsed / 1024 / 1024)}MB heap, ${Math.round(usage.rss / 1024 / 1024)}MB RSS`, 'info');
    });
    
    // Health check endpoint logging
    server.on('request', (req, res) => {
      if (req.url !== '/favicon.ico') {
        log(`${req.method} ${req.url} - ${res.statusCode}`, 'debug');
      }
    });
    
  } catch (error) {
    log(`Failed to start server: ${error.message}`, 'error');
    log(error.stack, 'error');
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = { startServer, app };