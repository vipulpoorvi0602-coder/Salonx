import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const DIST_DIR = path.resolve(__dirname, 'dist');
const DEFAULT_PORT = 3000;
const REQUESTED_PORT = Number(process.env.APP_PORT || process.env.PORT || DEFAULT_PORT);

// Middleware for parsing JSON
app.use(express.json());

// Health check endpoint for Cloud Run and load balancers
app.get(['/healthz', '/health', '/api/health'], (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Authoritative Server-side Admin Recovery Secret verification endpoint
app.post('/api/admin/verify-bootstrap', (req: Request, res: Response) => {
  const { secretKey } = req.body || {};
  const serverKey = process.env.ADMIN_BOOTSTRAP_KEY || process.env.VITE_ADMIN_BOOTSTRAP_KEY;
  if (!serverKey || !serverKey.trim()) {
    return res.status(503).json({
      success: false,
      message: 'ADMIN_BOOTSTRAP_KEY is not configured on the production server.',
    });
  }
  if (!secretKey || secretKey.trim() !== serverKey.trim()) {
    return res.status(401).json({
      success: false,
      message: 'Invalid Master Recovery Secret.',
    });
  }
  return res.status(200).json({
    success: true,
    message: 'Master Recovery Secret verified successfully.',
  });
});

// Dynamic static asset serving from dist folder
app.use(
  express.static(DIST_DIR, {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      // Hashed assets in assets/ directory can be safely cached long-term
      if (filePath.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      // Never cache index.html, service worker, or manifest files so updates are immediately discovered
      else if (
        filePath.endsWith('index.html') ||
        filePath.endsWith('sw.js') ||
        filePath.endsWith('registerSW.js') ||
        filePath.endsWith('push-worker.js') ||
        filePath.endsWith('firebase-messaging-sw.js') ||
        filePath.endsWith('manifest.webmanifest') ||
        filePath.endsWith('manifest.json')
      ) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);

// SPA fallback: send index.html for all non-API GET requests with strict no-cache
app.get('*', (_req: Request, res: Response) => {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(indexPath);
  } else {
    res.status(200).send('SALONX is starting up... Build directory pending.');
  }
});

function startServer(port: number, fallbackPort?: number) {
  const srv = app.listen(port, '0.0.0.0', () => {
    console.log(`SALONX server listening on http://0.0.0.0:${port}`);
  });

  srv.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE' && fallbackPort && port !== fallbackPort) {
      console.warn(`Port ${port} is in use (e.g. upstream reverse proxy). Falling back to port ${fallbackPort}...`);
      startServer(fallbackPort);
    } else {
      console.error(`SALONX server failed to start on port ${port}:`, err);
      process.exit(1);
    }
  });

  // Handle graceful shutdown for Cloud Run container lifecycle
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    srv.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    srv.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
}

startServer(REQUESTED_PORT, REQUESTED_PORT !== DEFAULT_PORT ? DEFAULT_PORT : undefined);
