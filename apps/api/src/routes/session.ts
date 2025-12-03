/**
 * Session Routes - API endpoints for diarization session management
 *
 * Endpoints:
 * - POST /api/session - Create a new session
 * - GET /api/session/:sessionId - Get session status
 * - DELETE /api/session/:sessionId - End session
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { speechService } from '../services/speechService.js';

export const sessionRouter = Router();

/**
 * POST /api/session
 * Create a new diarization session
 */
sessionRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { profileIds } = req.body;

		// Validate profileIds
		if (!profileIds) {
			res.status(400).json({
				error: 'INVALID_REQUEST',
				message: 'profileIds is required',
			});
			return;
		}

		if (!Array.isArray(profileIds)) {
			res.status(400).json({
				error: 'INVALID_REQUEST',
				message: 'profileIds must be an array',
			});
			return;
		}

		if (profileIds.length === 0) {
			res.status(400).json({
				error: 'INVALID_REQUEST',
				message: 'profileIds must not be empty',
			});
			return;
		}

		const session = await speechService.createSession({ profileIds });

		res.status(201).json({
			id: session.id,
			status: session.status,
			speakerMappings: session.speakerMappings,
			createdAt: session.createdAt,
		});
	} catch (error) {
		next(error);
	}
});

/**
 * GET /api/session/:sessionId
 * Get session status and details
 */
sessionRouter.get('/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { sessionId } = req.params;
        if (!sessionId) {
            res.status(400).json({
                error: 'INVALID_REQUEST',
                message: 'sessionId is required',
            });
            return;
        }

		const session = await speechService.getSession(sessionId);

		if (!session) {
			res.status(404).json({
				error: 'NOT_FOUND',
				message: 'Session not found',
			});
			return;
		}

		res.json({
			id: session.id,
			status: session.status,
			speakerMappings: session.speakerMappings,
			createdAt: session.createdAt,
			endedAt: session.endedAt,
		});
	} catch (error) {
		next(error);
	}
});

/**
 * DELETE /api/session/:sessionId
 * End a session
 */
sessionRouter.delete('/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { sessionId } = req.params;

        if (!sessionId) {
            res.status(400).json({
                error: 'INVALID_REQUEST',
                message: 'sessionId is required',
            });
            return;
        }
        
		const session = await speechService.deleteSession(sessionId);

		if (!session) {
			res.status(404).json({
				error: 'NOT_FOUND',
				message: 'Session not found',
			});
			return;
		}

		res.json({
			id: session.id,
			status: session.status,
			speakerMappings: session.speakerMappings,
			createdAt: session.createdAt,
			endedAt: session.endedAt,
		});
	} catch (error) {
		next(error);
	}
});
