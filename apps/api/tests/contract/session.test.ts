/**
 * Contract tests for Session API
 * TDD: Write tests first, verify API behavior matches OpenAPI spec
 *
 * Tests:
 * - POST /api/session - Create a new diarization session
 * - GET /api/session/{id} - Get session status
 * - DELETE /api/session/{id} - End session
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the speech service before importing routes
vi.mock('../../src/services/speechService.js', () => ({
	speechService: {
		createSession: vi.fn(),
		getSession: vi.fn(),
		deleteSession: vi.fn(),
	},
}));

// Import after mocking
import { sessionRouter } from '../../src/routes/session.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { speechService } from '../../src/services/speechService.js';

const app = express();
app.use(express.json());
app.use('/api/session', sessionRouter);
app.use(errorHandler);

describe('Session API Contract Tests', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('POST /api/session', () => {
		it('should create a new session with valid profileIds', async () => {
			const mockSession = {
				id: '123e4567-e89b-12d3-a456-426614174000',
				status: 'initializing',
				speakerMappings: [],
				createdAt: new Date().toISOString(),
			};

			vi.mocked(speechService.createSession).mockResolvedValue(mockSession);

			const response = await request(app)
				.post('/api/session')
				.send({
					profileIds: ['profile-1', 'profile-2'],
				})
				.expect('Content-Type', /json/)
				.expect(201);

			expect(response.body).toMatchObject({
				id: expect.any(String),
				status: expect.any(String),
				createdAt: expect.any(String),
			});
			expect(speechService.createSession).toHaveBeenCalledWith({
				profileIds: ['profile-1', 'profile-2'],
			});
		});

		it('should return 400 when profileIds is missing', async () => {
			const response = await request(app)
				.post('/api/session')
				.send({})
				.expect('Content-Type', /json/)
				.expect(400);

			expect(response.body).toMatchObject({
				error: expect.any(String),
				message: expect.any(String),
			});
		});

		it('should return 400 when profileIds is empty array', async () => {
			const response = await request(app)
				.post('/api/session')
				.send({ profileIds: [] })
				.expect('Content-Type', /json/)
				.expect(400);

			expect(response.body).toMatchObject({
				error: expect.any(String),
				message: expect.any(String),
			});
		});

		it('should return 400 when profileIds is not an array', async () => {
			const response = await request(app)
				.post('/api/session')
				.send({ profileIds: 'not-an-array' })
				.expect('Content-Type', /json/)
				.expect(400);

			expect(response.body).toMatchObject({
				error: expect.any(String),
				message: expect.any(String),
			});
		});

		it('should return 500 when Azure connection fails', async () => {
			vi.mocked(speechService.createSession).mockRejectedValue(
				new Error('Azure connection failed')
			);

			const response = await request(app)
				.post('/api/session')
				.send({ profileIds: ['profile-1'] })
				.expect('Content-Type', /json/)
				.expect(500);

			expect(response.body).toMatchObject({
				error: expect.any(String),
				message: expect.any(String),
			});
		});
	});

	describe('GET /api/session/:sessionId', () => {
		it('should return session details for valid session', async () => {
			const mockSession = {
				id: '123e4567-e89b-12d3-a456-426614174000',
				status: 'active',
				speakerMappings: [
					{
						profileId: 'profile-1',
						profileName: '田中さん',
						azureSpeakerId: 'Guest-1',
						isRegistered: true,
					},
				],
				createdAt: new Date().toISOString(),
			};

			vi.mocked(speechService.getSession).mockResolvedValue(mockSession);

			const response = await request(app)
				.get('/api/session/123e4567-e89b-12d3-a456-426614174000')
				.expect('Content-Type', /json/)
				.expect(200);

			expect(response.body).toMatchObject({
				id: '123e4567-e89b-12d3-a456-426614174000',
				status: 'active',
				speakerMappings: expect.any(Array),
			});
		});

		it('should return 404 for non-existent session', async () => {
			vi.mocked(speechService.getSession).mockResolvedValue(null);

			const response = await request(app)
				.get('/api/session/non-existent-id')
				.expect('Content-Type', /json/)
				.expect(404);

			expect(response.body).toMatchObject({
				error: expect.any(String),
				message: expect.any(String),
			});
		});

		it('should include speakerMappings in response', async () => {
			const mockSession = {
				id: '123e4567-e89b-12d3-a456-426614174000',
				status: 'active',
				speakerMappings: [
					{
						profileId: 'profile-1',
						profileName: '田中さん',
						azureSpeakerId: 'Guest-1',
						isRegistered: true,
					},
					{
						profileId: 'profile-2',
						profileName: '佐藤さん',
						azureSpeakerId: 'Guest-2',
						isRegistered: true,
					},
				],
				createdAt: new Date().toISOString(),
			};

			vi.mocked(speechService.getSession).mockResolvedValue(mockSession);

			const response = await request(app)
				.get('/api/session/123e4567-e89b-12d3-a456-426614174000')
				.expect(200);

			expect(response.body.speakerMappings).toHaveLength(2);
			expect(response.body.speakerMappings[0]).toMatchObject({
				profileId: 'profile-1',
				profileName: '田中さん',
				azureSpeakerId: 'Guest-1',
				isRegistered: true,
			});
		});
	});

	describe('DELETE /api/session/:sessionId', () => {
		it('should end session and return final state', async () => {
			const mockSession = {
				id: '123e4567-e89b-12d3-a456-426614174000',
				status: 'completed',
				speakerMappings: [],
				createdAt: new Date().toISOString(),
				endedAt: new Date().toISOString(),
			};

			vi.mocked(speechService.deleteSession).mockResolvedValue(mockSession);

			const response = await request(app)
				.delete('/api/session/123e4567-e89b-12d3-a456-426614174000')
				.expect('Content-Type', /json/)
				.expect(200);

			expect(response.body).toMatchObject({
				id: '123e4567-e89b-12d3-a456-426614174000',
				status: 'completed',
				endedAt: expect.any(String),
			});
		});

		it('should return 404 for non-existent session', async () => {
			vi.mocked(speechService.deleteSession).mockResolvedValue(null);

			const response = await request(app)
				.delete('/api/session/non-existent-id')
				.expect('Content-Type', /json/)
				.expect(404);

			expect(response.body).toMatchObject({
				error: expect.any(String),
				message: expect.any(String),
			});
		});
	});
});
