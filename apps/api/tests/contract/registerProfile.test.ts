/**
 * Contract tests for Register Profile API
 * TDD: Write tests first, verify API behavior matches OpenAPI spec
 *
 * Tests:
 * - POST /api/session/{id}/register-profile - Register voice profile with Azure
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the speech service before importing routes
vi.mock('../../src/services/speechService.js', () => ({
	speechService: {
		registerProfile: vi.fn(),
		getSession: vi.fn(),
	},
}));

// Import after mocking
import { speechRouter } from '../../src/routes/speech.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { speechService } from '../../src/services/speechService.js';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use('/api/session', speechRouter);
app.use(errorHandler);

describe('Register Profile API Contract Tests', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('POST /api/session/:sessionId/register-profile', () => {
		it('should register profile and return speaker mapping', async () => {
			const mockMapping = {
				sessionId: 'session-123',
				voiceProfileId: 'profile-123',
				displayName: '田中さん',
				azureSpeakerId: 'mock-speaker-001',
				status: 'completed',
			};

			vi.mocked(speechService.getSession).mockResolvedValue({
				id: 'session-123',
				status: 'initializing',
				speakerMappings: [],
				createdAt: new Date().toISOString(),
			});
			vi.mocked(speechService.registerProfile).mockResolvedValue(mockMapping);

			const response = await request(app)
				.post('/api/session/session-123/register-profile')
				.send({
					profileId: 'profile-123',
					profileName: '田中さん',
					audioBase64: 'dGVzdC1hdWRpby1kYXRh', // base64 encoded test data
				})
				.expect('Content-Type', /json/)
				.expect(200);

			expect(response.body).toMatchObject({
				speakerId: expect.any(String),
				profileId: 'profile-123',
				profileName: '田中さん',
			});
		});

		it('should return 404 when session does not exist', async () => {
			vi.mocked(speechService.getSession).mockResolvedValue(null);

			const response = await request(app)
				.post('/api/session/non-existent/register-profile')
				.send({
					profileId: 'profile-123',
					profileName: '田中さん',
					audioBase64: 'dGVzdC1hdWRpby1kYXRh',
				})
				.expect('Content-Type', /json/)
				.expect(404);

			expect(response.body).toMatchObject({
				error: expect.any(String),
				message: expect.any(String),
			});
		});

		it('should return 400 when profileId is missing', async () => {
			vi.mocked(speechService.getSession).mockResolvedValue({
				id: 'session-123',
				status: 'initializing',
				speakerMappings: [],
				createdAt: new Date().toISOString(),
			});

			const response = await request(app)
				.post('/api/session/session-123/register-profile')
				.send({
					profileName: '田中さん',
					audioBase64: 'dGVzdC1hdWRpby1kYXRh',
				})
				.expect('Content-Type', /json/)
				.expect(400);

			expect(response.body).toMatchObject({
				error: expect.any(String),
				message: expect.any(String),
			});
		});

		it('should return 400 when profileName is missing', async () => {
			vi.mocked(speechService.getSession).mockResolvedValue({
				id: 'session-123',
				status: 'initializing',
				speakerMappings: [],
				createdAt: new Date().toISOString(),
			});

			const response = await request(app)
				.post('/api/session/session-123/register-profile')
				.send({
					profileId: 'profile-123',
					audioBase64: 'dGVzdC1hdWRpby1kYXRh',
				})
				.expect('Content-Type', /json/)
				.expect(400);

			expect(response.body).toMatchObject({
				error: expect.any(String),
				message: expect.any(String),
			});
		});

		it('should return 400 when audioBase64 is missing', async () => {
			vi.mocked(speechService.getSession).mockResolvedValue({
				id: 'session-123',
				status: 'initializing',
				speakerMappings: [],
				createdAt: new Date().toISOString(),
			});

			const response = await request(app)
				.post('/api/session/session-123/register-profile')
				.send({
					profileId: 'profile-123',
					profileName: '田中さん',
				})
				.expect('Content-Type', /json/)
				.expect(400);

			expect(response.body).toMatchObject({
				error: expect.any(String),
				message: expect.any(String),
			});
		});

		it('should return 400 when audioBase64 is invalid', async () => {
			vi.mocked(speechService.getSession).mockResolvedValue({
				id: 'session-123',
				status: 'initializing',
				speakerMappings: [],
				createdAt: new Date().toISOString(),
			});
			vi.mocked(speechService.registerProfile).mockRejectedValue(
				new Error('Invalid audio data')
			);

			const response = await request(app)
				.post('/api/session/session-123/register-profile')
				.send({
					profileId: 'profile-123',
					profileName: '田中さん',
					audioBase64: 'not-valid-base64!!!',
				})
				.expect('Content-Type', /json/)
				.expect(400);

			expect(response.body).toMatchObject({
				error: expect.any(String),
				message: expect.any(String),
			});
		});

		it('should return 500 when Azure registration fails', async () => {
			vi.mocked(speechService.getSession).mockResolvedValue({
				id: 'session-123',
				status: 'initializing',
				speakerMappings: [],
				createdAt: new Date().toISOString(),
			});
			vi.mocked(speechService.registerProfile).mockRejectedValue(
				new Error('Azure service unavailable')
			);

			const response = await request(app)
				.post('/api/session/session-123/register-profile')
				.send({
					profileId: 'profile-123',
					profileName: '田中さん',
					audioBase64: 'dGVzdC1hdWRpby1kYXRh',
				})
				.expect('Content-Type', /json/)
				.expect(500);

			expect(response.body).toMatchObject({
				error: expect.any(String),
				message: expect.any(String),
			});
		});

		it('should handle multiple profile registrations', async () => {
			const mockMapping1 = {
				sessionId: 'session-123',
				profileId: 'profile-1',
				displayName: '田中さん',
				azureSpeakerId: 'mock-speaker-001',
				isRegistered: true,
			};
			const mockMapping2 = {
				sessionId: 'session-123',
				profileId: 'profile-2',
				displayName: '佐藤さん',
				azureSpeakerId: 'mock-speaker-002',
				isRegistered: true,
			};

			vi.mocked(speechService.getSession).mockResolvedValue({
				id: 'session-123',
				status: 'initializing',
				speakerMappings: [],
				createdAt: new Date().toISOString(),
			});
			vi.mocked(speechService.registerProfile)
				.mockResolvedValueOnce(mockMapping1)
				.mockResolvedValueOnce(mockMapping2);

			// Register first profile
			const response1 = await request(app)
				.post('/api/session/session-123/register-profile')
				.send({
					profileId: 'profile-1',
					profileName: '田中さん',
					audioBase64: 'dGVzdC1hdWRpby1kYXRh',
				})
				.expect(200);

			expect(response1.body.profileName).toBe('田中さん');

			// Register second profile
			const response2 = await request(app)
				.post('/api/session/session-123/register-profile')
				.send({
					profileId: 'profile-2',
					profileName: '佐藤さん',
					audioBase64: 'dGVzdC1hdWRpby1kYXRh',
				})
				.expect(200);

			expect(response2.body.profileName).toBe('佐藤さん');
		});
	});
});
