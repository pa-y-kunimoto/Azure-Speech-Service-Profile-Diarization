/**
 * Speech Routes - API endpoints for speech-related operations
 *
 * Endpoints:
 * - POST /api/session/:sessionId/register-profile - Register a voice profile
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { speechService } from '../services/speechService.js';

export const speechRouter = Router();

/**
 * POST /api/session/:sessionId/register-profile
 * Register a voice profile with Azure Speech Service
 */
speechRouter.post(
	'/:sessionId/register-profile',
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { sessionId } = req.params;
			const { profileId, profileName, audioBase64 } = req.body;

            if (!sessionId) {
                res.status(400).json({
                    error: 'INVALID_REQUEST',
                    message: 'sessionId is required',
                });
                return;
            }

			// Check session exists
			const session = await speechService.getSession(sessionId);
			if (!session) {
				res.status(404).json({
					error: 'NOT_FOUND',
					message: 'Session not found',
				});
				return;
			}

			// Validate required fields
			if (!profileId) {
				res.status(400).json({
					error: 'INVALID_REQUEST',
					message: 'profileId is required',
				});
				return;
			}

			if (!profileName) {
				res.status(400).json({
					error: 'INVALID_REQUEST',
					message: 'profileName is required',
				});
				return;
			}

			if (!audioBase64) {
				res.status(400).json({
					error: 'INVALID_REQUEST',
					message: 'audioBase64 is required',
				});
				return;
			}

			// Validate base64 format (basic check)
			try {
				// Try to decode to verify it's valid base64
				const buffer = Buffer.from(audioBase64, 'base64');
				if (buffer.length === 0) {
					throw new Error('Empty audio data');
				}
			} catch {
				res.status(400).json({
					error: 'INVALID_AUDIO',
					message: 'Invalid audio data format',
				});
				return;
			}

			const mapping = await speechService.registerProfile(
				sessionId,
				profileId,
				profileName,
				audioBase64
			);

			res.json({
				speakerId: mapping.azureSpeakerId || null,
				profileId: mapping.voiceProfileId,
				profileName: mapping.displayName,
				status: mapping.status,
				isRegistered: mapping.status === 'completed',
			});
		} catch (error) {
			// Handle specific errors
			if (error instanceof Error) {
				if (error.message.includes('Invalid audio')) {
					res.status(400).json({
						error: 'INVALID_AUDIO',
						message: error.message,
					});
					return;
				}
			}
			next(error);
		}
	}
);
