import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { config } from './config.js';
import { roomRoutes } from './routes/rooms.js';
import { oembedRoutes } from './routes/oembed.js';
import { WebSocketServer } from './ws/server.js';

const app = express();

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow oEmbed iframes
}));
app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// API Routes
app.use('/api/rooms', roomRoutes);
app.use('/api/oembed', oembedRoutes);

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
});

export { app, server, wss };
