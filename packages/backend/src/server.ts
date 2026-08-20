import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { config } from './config.js';
import { roomRoutes } from './routes/rooms.js';
import { oembedRoutes } from './routes/oembed.js';
import { WebSocketServer } from './ws/server.js';

const app = express();

// Vercel gives every deploy a new hostname, so preview URLs can never be
// covered by an exact-match list.
const VERCEL_HOSTNAME = /^https:\/\/[a-z0-9][a-z0-9-]*\.vercel\.app$/;

// Read CORS_ORIGIN directly rather than via config, whose localhost default
// would make an unset value indistinguishable from a configured one.
// CORS_ORIGIN may be a single origin or a comma-separated list.
const configuredOrigins: (string | RegExp)[] = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

// Unset: assume a fresh deploy and accept local development plus Vercel, so
// the app works before anything is configured. Set: trust it exactly, and
// admit preview hostnames only when explicitly asked to.
const allowedOrigins: (string | RegExp)[] = configuredOrigins.length > 0
    ? [...configuredOrigins]
    : ['http://localhost:5173', 'http://localhost:3000', VERCEL_HOSTNAME];

if (configuredOrigins.length > 0 && process.env.CORS_ALLOW_VERCEL_PREVIEWS === 'true') {
    allowedOrigins.push(VERCEL_HOSTNAME);
}

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow oEmbed iframes
}));
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Service index. This server is the API only - the web app is deployed
// separately (Vercel). Without this, GET / fell through to Express's default
// handler, which responds with the bare text 'Cannot GET /'.
app.get('/', (_req, res) => {
    res.json({
        service: 'reelroom-backend',
        status: 'ok',
        message: 'ReelRoom API. The web app is deployed separately - open the frontend URL, not this one.',
        allowedOrigins: allowedOrigins.map((entry) => entry.toString()),
        endpoints: {
            health: 'GET /health',
            createRoom: 'POST /api/rooms',
            getRoom: 'GET /api/rooms/:code',
            joinRoom: 'POST /api/rooms/:code/join',
            getQueue: 'GET /api/rooms/:code/queue',
            addToQueue: 'POST /api/rooms/:code/queue',
            removeFromQueue: 'DELETE /api/rooms/:code/queue/:itemId',
            participants: 'GET /api/rooms/:code/participants',
            oembed: 'GET /api/oembed',
            websocket: 'WS /ws',
        },
    });
});

// API Routes
app.use('/api/rooms', roomRoutes);
app.use('/api/oembed', oembedRoutes);

// 404 handler. Keeps unmatched paths returning the same JSON error shape as
// the rest of the API instead of Express's default HTML response.
app.use((_req: express.Request, res: express.Response) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: 'Endpoint not found',
        },
    });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: config.nodeEnv === 'development' ? err.message : 'Internal server error',
        },
    });
});

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer(server);

// Start server
server.listen(config.port, () => {
    console.log(`🚀 ReelRoom Backend running on port ${config.port}`);
    console.log(`   Health: http://localhost:${config.port}/health`);
    console.log(`   WebSocket: ws://localhost:${config.port}`);
    console.log(`   Allowed origins: ${allowedOrigins.map((entry) => entry.toString()).join(', ')}`);
});

export { app, server, wss };
