import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.js';
import { statsRouter } from './routes/stats.js';
import { matchRouter } from './routes/matches.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { cosmeticsRouter } from './routes/cosmetics.js';
import { tournamentsRouter } from './routes/tournaments.js';
import { clansRouter } from './routes/clans.js';
import { seasonsRouter } from './routes/seasons.js';
import { adminRouter } from './routes/admin.js';
import { achievementsRouter } from './routes/achievements.js';
import { setupGameSocket } from './sockets/gameSocket.js';

dotenv.config();

// Production safety: refuse to boot without a strong JWT secret.
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'dev-secret-change-in-production' || secret.length < 32) {
    console.error(
      'FATAL: JWT_SECRET must be set to a strong random value (>=32 chars) in production.\n' +
      'Generate one with: openssl rand -hex 64'
    );
    process.exit(1);
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(helmet());
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// REST routes
app.use('/api/auth', authRouter);
app.use('/api/stats', statsRouter);
app.use('/api/matches', matchRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/cosmetics', cosmeticsRouter);
app.use('/api/tournaments', tournamentsRouter);
app.use('/api/clans', clansRouter);
app.use('/api/seasons', seasonsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/achievements', achievementsRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Create HTTP server and attach Socket.IO
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CLIENT_URL,
    credentials: true,
  },
});

setupGameSocket(io as any);

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Socket.IO listening for multiplayer connections`);
});

export default app;
