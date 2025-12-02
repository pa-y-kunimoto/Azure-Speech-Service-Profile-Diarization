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
import { sessionRouter } from './routes/session.js';
import { speechRouter } from './routes/speech.js';
import { logMockModeStatus, createMockDiarizationClient } from './services/mockSpeechService.js';
import { setupWebSocketServer } from './ws/index.js';
import { DiarizationClient } from '@speaker-diarization/speech-client';

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
app.use('/api/session', sessionRouter);
app.use('/api/session', speechRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
	res.status(404).json({
		error: 'Not Found',
		message: 'The requested resource was not found',
	});
});

// Error handler (must be last)
app.use(errorHandler);

// Setup WebSocket server for real-time transcription
const useMockClient = process.env.USE_MOCK_SPEECH === 'true' || !process.env.SPEECH_KEY;
setupWebSocketServer(httpServer, {
	createDiarizationClient: (sessionId: string) => {
		if (useMockClient) {
			return createMockDiarizationClient(sessionId);
		}
		const speechKey = process.env.SPEECH_KEY;
		const speechRegion = process.env.SPEECH_REGION;
		if (!speechKey || !speechRegion) {
			console.warn('SPEECH_KEY or SPEECH_REGION not set, using mock client');
			return createMockDiarizationClient(sessionId);
		}
		return new DiarizationClient({
			subscriptionKey: speechKey,
			region: speechRegion,
			endpoint: process.env.SPEECH_ENDPOINT,
			language: 'ja-JP',
		});
	},
});

// Start server
const PORT = process.env.PORT ?? 3001;

httpServer.listen(PORT, () => {
	console.log(`🚀 API server running on http://localhost:${PORT}`);
	console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
	console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws/session/{sessionId}`);
	logMockModeStatus();
});

export { app, httpServer };
