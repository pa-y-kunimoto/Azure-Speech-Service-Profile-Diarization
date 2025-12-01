/**
 * Health check endpoint
 * GET /api/health
 */

import { VERSION } from '@speaker-diarization/core';
import { type Request, type Response, Router } from 'express';
import { isMockMode } from '../services/mockSpeechService.js';

const router = Router();

/**
 * Health check response
 */
interface HealthResponse {
	status: 'ok' | 'degraded' | 'error';
	timestamp: string;
	version: string;
	uptime: number;
	mockMode: boolean;
	services: {
		azure: {
			configured: boolean;
			status: 'unknown' | 'connected' | 'mocked' | 'error';
		};
	};
}

/**
 * GET /api/health
 * Returns server health status
 */
router.get('/', (_req: Request, res: Response<HealthResponse>) => {
	const speechKey = process.env.SPEECH_KEY;
	const speechEndpoint = process.env.SPEECH_ENDPOINT;
	const azureConfigured = Boolean(speechKey && speechEndpoint);
	const mockMode = isMockMode();

	const response: HealthResponse = {
		status: 'ok',
		timestamp: new Date().toISOString(),
		version: VERSION,
		uptime: process.uptime(),
		mockMode,
		services: {
			azure: {
				configured: azureConfigured,
				status: mockMode ? 'mocked' : 'unknown',
			},
		},
	};

	res.json(response);
});

export { router as healthRouter };
