/**
 * Unit tests for useDiarizationSession composable
 * TDD: Write tests first for session management functionality
 *
 * Tests:
 * - Session creation with profile selection
 * - Session state management
 * - Profile registration with speakerId mapping
 * - Error handling
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock useApiFetch to avoid Nuxt dependency
const mockApiFetch = vi.fn();
vi.mock('~/composables/useApiFetch', () => ({
	useApiFetch: () => ({
		apiFetch: mockApiFetch,
		getBaseUrl: () => 'http://localhost:3000',
		getWebSocketUrl: (endpoint: string) => `ws://localhost:3000${endpoint}`,
	}),
}));

// Import after mocking
import { useDiarizationSession } from '~/composables/useDiarizationSession';

describe('useDiarizationSession', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockApiFetch.mockReset();
	});

	describe('initialization', () => {
		it('should initialize with idle status', () => {
			const { status, isActive, error } = useDiarizationSession();

			expect(status.value).toBe('idle');
			expect(isActive.value).toBe(false);
			expect(error.value).toBeNull();
		});

		it('should have empty speaker mappings initially', () => {
			const { speakerMappings } = useDiarizationSession();

			expect(speakerMappings.value).toEqual([]);
		});

		it('should not have session ID initially', () => {
			const { sessionId } = useDiarizationSession();

			expect(sessionId.value).toBeNull();
		});
	});

	describe('createSession', () => {
		it('should create session with selected profile IDs', async () => {
			mockApiFetch.mockResolvedValueOnce({
				id: 'session-123',
				status: 'idle',
				createdAt: new Date().toISOString(),
				speakerMappings: [],
			});

			const { createSession, sessionId } = useDiarizationSession();
			await createSession(['profile-1', 'profile-2']);

			expect(mockApiFetch).toHaveBeenCalledWith('/api/session', {
				method: 'POST',
				body: { profileIds: ['profile-1', 'profile-2'] },
			});
			expect(sessionId.value).toBe('session-123');
		});

		it('should update status to connecting while creating', async () => {
			let resolvePromise!: (value: unknown) => void;
			mockApiFetch.mockReturnValueOnce(
				new Promise((resolve) => {
					resolvePromise = resolve;
				})
			);

			const { createSession, status } = useDiarizationSession();
			const promise = createSession(['profile-1']);

			expect(status.value).toBe('connecting');

			resolvePromise({
				id: 'session-123',
				status: 'idle',
				createdAt: new Date().toISOString(),
				speakerMappings: [],
			});

			await promise;
		});

		it('should handle creation error', async () => {
			mockApiFetch.mockRejectedValueOnce(new Error('Connection failed'));

			const { createSession, error, status } = useDiarizationSession();
			await createSession(['profile-1']);

			expect(error.value).toBeTruthy();
			expect(error.value?.message).toContain('Connection failed');
			expect(status.value).toBe('error');
		});

		it('should require at least one profile', async () => {
			const { createSession, error } = useDiarizationSession();
			await createSession([]);

			expect(error.value).toBeTruthy();
			expect(error.value?.message).toContain('プロフィール');
		});
	});

	describe('registerProfile', () => {
		beforeEach(async () => {
			mockApiFetch.mockResolvedValueOnce({
				id: 'session-123',
				status: 'idle',
				createdAt: new Date().toISOString(),
				speakerMappings: [],
			});
		});

		it('should register profile and receive speaker mapping', async () => {
			const audioData = 'base64-audio-data';
			mockApiFetch.mockResolvedValueOnce({
				speakerId: 'Guest-1',
				profileId: 'profile-1',
				profileName: '田中さん',
				status: 'completed',
			});

			const { createSession, registerProfile, speakerMappings } = useDiarizationSession();
			await createSession(['profile-1']);
			await registerProfile('profile-1', '田中さん', audioData);

			expect(speakerMappings.value).toHaveLength(1);
			expect(speakerMappings.value[0]).toEqual({
				voiceProfileId: 'profile-1',
				displayName: '田中さん',
				azureSpeakerId: 'Guest-1',
				status: 'completed',
				sessionId: 'session-123',
			});
		});

		it('should call API with correct parameters', async () => {
			const audioData = 'base64-audio-data';
			mockApiFetch.mockResolvedValueOnce({
				speakerId: 'Guest-1',
				profileId: 'profile-1',
				profileName: '田中さん',
			});

			const { createSession, registerProfile } = useDiarizationSession();
			await createSession(['profile-1']);
			await registerProfile('profile-1', '田中さん', audioData);

			expect(mockApiFetch).toHaveBeenLastCalledWith(
				'/api/session/session-123/register-profile',
				expect.objectContaining({
					method: 'POST',
					body: {
						profileId: 'profile-1',
						profileName: '田中さん',
						audioBase64: audioData,
					},
				})
			);
		});

		it('should update status to registering during registration', async () => {
			let resolvePromise!: (value: unknown) => void;
			mockApiFetch.mockReturnValueOnce(
				new Promise((resolve) => {
					resolvePromise = resolve;
				})
			);

			const { createSession, registerProfile, status } = useDiarizationSession();
			await createSession(['profile-1']);

			const promise = registerProfile('profile-1', '田中さん', 'audio-data');

			expect(status.value).toBe('registering');

			resolvePromise({
				speakerId: 'Guest-1',
				profileId: 'profile-1',
				profileName: '田中さん',
			});

			await promise;
		});

		it('should handle registration error', async () => {
			mockApiFetch.mockRejectedValueOnce(new Error('Registration failed'));

			const { createSession, registerProfile, error } = useDiarizationSession();
			await createSession(['profile-1']);
			await registerProfile('profile-1', '田中さん', 'audio-data');

			expect(error.value).toBeTruthy();
			expect(error.value?.message).toContain('Registration failed');
		});

		it('should fail if no active session', async () => {
			const { registerProfile, error } = useDiarizationSession();
			await registerProfile('profile-1', '田中さん', 'audio-data');

			expect(error.value).toBeTruthy();
			expect(error.value?.message).toContain('セッション');
		});
	});

	describe('registerAllProfiles', () => {
		beforeEach(async () => {
			mockApiFetch.mockResolvedValueOnce({
				id: 'session-123',
				status: 'idle',
				createdAt: new Date().toISOString(),
				speakerMappings: [],
			});
		});

		it('should register multiple profiles sequentially', async () => {
			const profiles = [
				{ id: 'profile-1', name: '田中さん', audioBase64: 'audio-1' },
				{ id: 'profile-2', name: '佐藤さん', audioBase64: 'audio-2' },
			];

			mockApiFetch
				.mockResolvedValueOnce({
					speakerId: 'Guest-1',
					profileId: 'profile-1',
					profileName: '田中さん',
				})
				.mockResolvedValueOnce({
					speakerId: 'Guest-2',
					profileId: 'profile-2',
					profileName: '佐藤さん',
				});

			const { createSession, registerAllProfiles, speakerMappings } = useDiarizationSession();
			await createSession(['profile-1', 'profile-2']);
			await registerAllProfiles(profiles);

			expect(speakerMappings.value).toHaveLength(2);
		});

		it('should track registration progress', async () => {
			const profiles = [
				{ id: 'profile-1', name: '田中さん', audioBase64: 'audio-1' },
				{ id: 'profile-2', name: '佐藤さん', audioBase64: 'audio-2' },
			];

			let resolveFirst!: (value: unknown) => void;
			mockApiFetch
				.mockReturnValueOnce(
					new Promise((resolve) => {
						resolveFirst = resolve;
					})
				)
				.mockResolvedValueOnce({
					speakerId: 'Guest-2',
					profileId: 'profile-2',
					profileName: '佐藤さん',
				});

			const { createSession, registerAllProfiles, registrationProgress } = useDiarizationSession();
			await createSession(['profile-1', 'profile-2']);
			const promise = registerAllProfiles(profiles);

			expect(registrationProgress.value).toEqual({
				current: 0,
				total: 2,
			});

			resolveFirst({
				speakerId: 'Guest-1',
				profileId: 'profile-1',
				profileName: '田中さん',
			});

			await promise;

			expect(registrationProgress.value).toEqual({
				current: 2,
				total: 2,
			});
		});
	});

	describe('getSession', () => {
		it('should fetch current session state', async () => {
			mockApiFetch.mockResolvedValueOnce({
				id: 'session-123',
				status: 'active',
				createdAt: new Date().toISOString(),
				speakerMappings: [
					{
						speakerId: 'Guest-1',
						profileId: 'profile-1',
						profileName: '田中さん',
						isRegistered: true,
					},
				],
			});

			const { getSession, status, speakerMappings } = useDiarizationSession();
			await getSession('session-123');

			expect(status.value).toBe('active');
			expect(speakerMappings.value).toHaveLength(1);
		});

		it('should call correct API endpoint', async () => {
			mockApiFetch.mockResolvedValueOnce({
				id: 'session-123',
				status: 'active',
				createdAt: new Date().toISOString(),
				speakerMappings: [],
			});

			const { getSession } = useDiarizationSession();
			await getSession('session-123');

			expect(mockApiFetch).toHaveBeenCalledWith('/api/session/session-123');
		});

		it('should handle session not found', async () => {
			mockApiFetch.mockRejectedValueOnce({
				statusCode: 404,
				message: 'Session not found',
			});

			const { getSession, error } = useDiarizationSession();
			await getSession('invalid-session');

			expect(error.value).toBeTruthy();
		});
	});

	describe('endSession', () => {
		beforeEach(async () => {
			mockApiFetch.mockResolvedValueOnce({
				id: 'session-123',
				status: 'idle',
				createdAt: new Date().toISOString(),
				speakerMappings: [],
			});
		});

		it('should end active session', async () => {
			mockApiFetch.mockResolvedValueOnce({
				id: 'session-123',
				status: 'ended',
				createdAt: new Date().toISOString(),
				endedAt: new Date().toISOString(),
				speakerMappings: [],
			});

			const { createSession, endSession, status } = useDiarizationSession();
			await createSession(['profile-1']);
			await endSession();

			expect(status.value).toBe('ended');
		});

		it('should call DELETE endpoint', async () => {
			mockApiFetch.mockResolvedValueOnce({
				id: 'session-123',
				status: 'ended',
				createdAt: new Date().toISOString(),
				endedAt: new Date().toISOString(),
				speakerMappings: [],
			});

			const { createSession, endSession } = useDiarizationSession();
			await createSession(['profile-1']);
			await endSession();

			expect(mockApiFetch).toHaveBeenLastCalledWith('/api/session/session-123', {
				method: 'DELETE',
			});
		});

		it('should reset state after ending session', async () => {
			mockApiFetch.mockResolvedValueOnce({
				id: 'session-123',
				status: 'ended',
				createdAt: new Date().toISOString(),
				endedAt: new Date().toISOString(),
				speakerMappings: [],
			});

			const { createSession, endSession, isActive } = useDiarizationSession();
			await createSession(['profile-1']);
			await endSession();

			expect(isActive.value).toBe(false);
		});
	});

	describe('state helpers', () => {
		it('should compute isActive correctly', async () => {
			mockApiFetch.mockResolvedValueOnce({
				id: 'session-123',
				status: 'active',
				createdAt: new Date().toISOString(),
				speakerMappings: [],
			});

			const { createSession, isActive, status } = useDiarizationSession();
			expect(isActive.value).toBe(false);

			await createSession(['profile-1']);
			// Simulate status change to active
			status.value = 'active';

			expect(isActive.value).toBe(true);
		});

		it('should compute isRegistering correctly', async () => {
			const { isRegistering, status } = useDiarizationSession();

			expect(isRegistering.value).toBe(false);

			status.value = 'registering';
			expect(isRegistering.value).toBe(true);
		});

		it('should compute hasError correctly', async () => {
			const { hasError, error } = useDiarizationSession();

			expect(hasError.value).toBe(false);

			error.value = new Error('Test error');
			expect(hasError.value).toBe(true);
		});

		it('should provide speaker name lookup', async () => {
			mockApiFetch.mockResolvedValueOnce({
				id: 'session-123',
				status: 'idle',
				createdAt: new Date().toISOString(),
				speakerMappings: [],
			});
			mockApiFetch.mockResolvedValueOnce({
				speakerId: 'Guest-1',
				profileId: 'profile-1',
				profileName: '田中さん',
			});

			const { createSession, registerProfile, getSpeakerName } = useDiarizationSession();
			await createSession(['profile-1']);
			await registerProfile('profile-1', '田中さん', 'audio');

			expect(getSpeakerName('Guest-1')).toBe('田中さん');
			expect(getSpeakerName('unknown')).toBe('Unknown');
		});
	});

	describe('clearError', () => {
		it('should clear error state', async () => {
			mockApiFetch.mockRejectedValueOnce(new Error('Test error'));

			const { createSession, clearError, error } = useDiarizationSession();
			await createSession(['profile-1']);

			expect(error.value).toBeTruthy();

			clearError();
			expect(error.value).toBeNull();
		});
	});
});
