/**
 * Express.js server entry point for Speaker Diarization API
 */

import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Express, type Request, type Response } from 'express';

import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { logMockModeStatus } from './services/mockSpeechService.js';

// Load environment variables from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app: Express = express();
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Larger limit for audio data
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/health', healthRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
	res.status(404).json({
		error: 'Not Found',
		message: 'The requested resource was not found',
	});
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT ?? 3001;

httpServer.listen(PORT, () => {
	console.log(`🚀 API server running on http://localhost:${PORT}`);
	console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
	logMockModeStatus();
});

export { app, httpServer };
