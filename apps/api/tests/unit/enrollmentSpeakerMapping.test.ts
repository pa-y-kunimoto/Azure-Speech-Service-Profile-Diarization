/**
 * Enrollment Speaker Mapping Tests
 *
 * Tests for the speaker detection and mapping during profile enrollment.
 * Ensures that speakers are correctly tracked and mapped even when
 * transcription events don't contain text.
 */

import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeService } from '../../src/services/realtimeService';

// Mock DiarizationClient interface
interface MockDiarizationClient {
	enrollVoiceProfile(
		profileId: string,
		audioData: Buffer
	): Promise<{ profileId: string; speakerId: string }>;
	startTranscription(): Promise<void>;
	stopTranscription(): Promise<void>;
	pushAudioChunk(chunk: Uint8Array): void;
	setSpeakerMapping(azureSpeakerId: string, profileId: string, displayName: string): void;
	getSpeakerName(azureSpeakerId: string): string;
	on(event: string, callback: (...args: unknown[]) => void): void;
	off(event: string, callback: (...args: unknown[]) => void): void;
	dispose(): Promise<void>;
	isTranscribing: boolean;
}

describe('EnrollmentSpeakerMapping', () => {
	let service: RealtimeService;
	let mockClient: MockDiarizationClient;
	let clientEventEmitter: EventEmitter;
	const testSessionId = 'test-enrollment-session';

	beforeEach(() => {
		clientEventEmitter = new EventEmitter();

		mockClient = {
			enrollVoiceProfile: vi.fn().mockResolvedValue({ profileId: 'p1', speakerId: 'Guest-1' }),
			startTranscription: vi.fn().mockResolvedValue(undefined),
			stopTranscription: vi.fn().mockResolvedValue(undefined),
			pushAudioChunk: vi.fn(),
			setSpeakerMapping: vi.fn(),
			getSpeakerName: vi.fn().mockReturnValue('Unknown Speaker'),
			on: vi.fn((event, callback) => clientEventEmitter.on(event, callback)),
			off: vi.fn((event, callback) => clientEventEmitter.off(event, callback)),
			dispose: vi.fn().mockResolvedValue(undefined),
			isTranscribing: false,
		};

		service = new RealtimeService(mockClient as unknown as ConstructorParameters<typeof RealtimeService>[0], testSessionId);
	});

	afterEach(async () => {
		clientEventEmitter.removeAllListeners();
		vi.clearAllMocks();
	});

	describe('profile registration', () => {
		it('should accept profile registration', () => {
			const profile = {
				profileId: 'profile-1',
				profileName: 'Testing Profile',
				audioBase64: createMockWavBase64(3000), // 3 seconds of audio
			};

			service.registerProfile(profile);
			// Should not throw
		});
	});

	describe('enrollment speaker tracking', () => {
		it('should track speaker from transcribing event during enrollment', async () => {
			await service.start();

			const profile = {
				profileId: 'profile-1',
				profileName: 'Testing Profile',
				audioBase64: createMockWavBase64(1000), // 1 second of audio
			};
			service.registerProfile(profile);

			// Start enrollment in background
			const enrollmentPromise = service.startEnrollment();

			// Wait a bit for audio to be processed
			await sleep(100);

			// Simulate Azure detecting speaker with text
			clientEventEmitter.emit('transcribing', {
				result: {
					text: 'テスト音声',
					speakerId: 'Guest-1',
					offset: 0,
					duration: 500,
				},
			});

			// Emit final transcription to trigger enrollment wait completion
			clientEventEmitter.emit('transcribed', {
				result: {
					text: 'テスト音声',
					speakerId: 'Guest-1',
					offset: 0,
					duration: 500,
				},
			});

			await enrollmentPromise;

			// Should have mapped the speaker
			expect(mockClient.setSpeakerMapping).toHaveBeenCalledWith(
				'Guest-1',
				'profile-1',
				'Testing Profile'
			);
		});

		it('should track speaker from transcribing event even without text', async () => {
			await service.start();

			const profile = {
				profileId: 'profile-1',
				profileName: 'Testing Profile',
				audioBase64: createMockWavBase64(1000),
			};
			service.registerProfile(profile);

			const enrollmentPromise = service.startEnrollment();
			await sleep(100);

			// Simulate Azure detecting speaker WITHOUT text (only speakerId)
			clientEventEmitter.emit('transcribing', {
				result: {
					speakerId: 'Guest-1',
					offset: 0,
					duration: 500,
				},
			});

			// Emit final transcription (with or without text)
			clientEventEmitter.emit('transcribed', {
				result: {
					speakerId: 'Guest-1',
					offset: 0,
					duration: 500,
				},
			});

			await enrollmentPromise;

			// Should have mapped the speaker even without text
			expect(mockClient.setSpeakerMapping).toHaveBeenCalledWith(
				'Guest-1',
				'profile-1',
				'Testing Profile'
			);
		});

		it('should track speaker from transcribed event during enrollment', async () => {
			await service.start();

			const profile = {
				profileId: 'profile-1',
				profileName: 'test-user',
				audioBase64: createMockWavBase64(1000),
			};
			service.registerProfile(profile);

			const enrollmentPromise = service.startEnrollment();
			await sleep(100);

			// Simulate Azure detecting speaker in transcribed event
			clientEventEmitter.emit('transcribed', {
				result: {
					text: '最終結果',
					speakerId: 'Guest-2',
					offset: 0,
					duration: 1000,
				},
			});

			await enrollmentPromise;

			expect(mockClient.setSpeakerMapping).toHaveBeenCalledWith(
				'Guest-2',
				'profile-1',
				'test-user'
			);
		});

		it('should track speaker from speakerDetected event during enrollment', async () => {
			await service.start();

			const profile = {
				profileId: 'profile-1',
				profileName: 'detected-speaker',
				audioBase64: createMockWavBase64(1000),
			};
			service.registerProfile(profile);

			const enrollmentPromise = service.startEnrollment();
			await sleep(100);

			// Simulate speakerDetected event
			clientEventEmitter.emit('speakerDetected', 'Guest-3');

			// Also emit a transcribed event to complete the enrollment wait
			clientEventEmitter.emit('transcribed', {
				result: {
					text: '完了',
					speakerId: 'Guest-3',
					offset: 0,
					duration: 500,
				},
			});

			await enrollmentPromise;

			expect(mockClient.setSpeakerMapping).toHaveBeenCalledWith(
				'Guest-3',
				'profile-1',
				'detected-speaker'
			);
		});

		it('should ignore Unknown speaker during enrollment', async () => {
			await service.start();

			const profile = {
				profileId: 'profile-1',
				profileName: 'test-user',
				audioBase64: createMockWavBase64(1000),
			};
			service.registerProfile(profile);

			const enrollmentPromise = service.startEnrollment();
			await sleep(100);

			// Simulate Azure returning Unknown speaker
			clientEventEmitter.emit('transcribing', {
				result: {
					text: 'テスト',
					speakerId: 'Unknown',
					offset: 0,
					duration: 500,
				},
			});

			clientEventEmitter.emit('transcribed', {
				result: {
					text: 'テスト',
					speakerId: 'Unknown',
					offset: 0,
					duration: 500,
				},
			});

			await enrollmentPromise;

			// Should NOT map Unknown speaker
			expect(mockClient.setSpeakerMapping).not.toHaveBeenCalled();
		});

		it('should map all detected speakers to the same profile during enrollment', async () => {
			await service.start();

			const profile = {
				profileId: 'profile-1',
				profileName: 'multi-speaker-profile',
				audioBase64: createMockWavBase64(2000),
			};
			service.registerProfile(profile);

			const enrollmentPromise = service.startEnrollment();
			await sleep(100);

			// Simulate multiple speakers detected during same profile
			clientEventEmitter.emit('speakerDetected', 'Guest-1');
			clientEventEmitter.emit('transcribing', {
				result: { speakerId: 'Guest-2', text: 'Hello' },
			});

			clientEventEmitter.emit('transcribed', {
				result: {
					text: '完了',
					speakerId: 'Guest-1',
					offset: 0,
					duration: 500,
				},
			});

			await enrollmentPromise;

			// Both speakers should be mapped to the same profile
			expect(mockClient.setSpeakerMapping).toHaveBeenCalledWith(
				'Guest-1',
				'profile-1',
				'multi-speaker-profile'
			);
			expect(mockClient.setSpeakerMapping).toHaveBeenCalledWith(
				'Guest-2',
				'profile-1',
				'multi-speaker-profile'
			);
		});
	});

	describe('enrollment events', () => {
		it('should emit speakerMapped event when speaker is mapped', async () => {
			await service.start();

			const mappedCallback = vi.fn();
			service.on('speakerMapped', mappedCallback);

			const profile = {
				profileId: 'profile-1',
				profileName: 'Testing Profile',
				audioBase64: createMockWavBase64(1000),
			};
			service.registerProfile(profile);

			const enrollmentPromise = service.startEnrollment();
			await sleep(100);

			clientEventEmitter.emit('transcribed', {
				result: {
					text: 'テスト',
					speakerId: 'Guest-1',
					offset: 0,
					duration: 500,
				},
			});

			await enrollmentPromise;

			expect(mappedCallback).toHaveBeenCalledWith({
				speakerId: 'Guest-1',
				profileId: 'profile-1',
				profileName: 'Testing Profile',
			});
		});

		it('should add unmapped profile to auto-mapping queue when no speaker detected', async () => {
			await service.start();

			const completeCallback = vi.fn();
			service.on('enrollmentComplete', completeCallback);

			const profile = {
				profileId: 'profile-1',
				profileName: 'silent-profile',
				audioBase64: createMockWavBase64(500), // Short audio
			};
			service.registerProfile(profile);

			// Don't emit any speaker events, let enrollment timeout
			await service.startEnrollment();

			// Should include unmapped profile in the complete event
			expect(completeCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					enrolled: 1,
					mapped: 0,
					unmappedProfiles: ['silent-profile'],
				})
			);
		});

		it('should emit enrollmentComplete event with correct counts', async () => {
			await service.start();

			const completeCallback = vi.fn();
			service.on('enrollmentComplete', completeCallback);

			const profile = {
				profileId: 'profile-1',
				profileName: 'test-user',
				audioBase64: createMockWavBase64(1000),
			};
			service.registerProfile(profile);

			const enrollmentPromise = service.startEnrollment();
			await sleep(100);

			clientEventEmitter.emit('transcribed', {
				result: {
					text: 'テスト',
					speakerId: 'Guest-1',
					offset: 0,
					duration: 500,
				},
			});

			await enrollmentPromise;

			expect(completeCallback).toHaveBeenCalledWith({
				enrolled: 1,
				mapped: 1,
				unmappedProfiles: [],
			});
		});
	});

	describe('waitForEnrollmentTranscription', () => {
		it('should wait for transcribed event before proceeding', async () => {
			await service.start();

			const profile = {
				profileId: 'profile-1',
				profileName: 'wait-test',
				audioBase64: createMockWavBase64(1000),
			};
			service.registerProfile(profile);

			const startTime = Date.now();
			const enrollmentPromise = service.startEnrollment();

			// Wait 200ms before emitting transcribed
			await sleep(200);
			clientEventEmitter.emit('transcribed', {
				result: {
					text: 'テスト',
					speakerId: 'Guest-1',
					offset: 0,
					duration: 500,
				},
			});

			await enrollmentPromise;
			const elapsed = Date.now() - startTime;

			// Should have waited at least 200ms for the transcribed event
			// Plus some buffer for processing
			expect(elapsed).toBeGreaterThanOrEqual(200);
			expect(mockClient.setSpeakerMapping).toHaveBeenCalled();
		});

		it('should timeout and proceed if no transcribed event received', async () => {
			await service.start();

			const profile = {
				profileId: 'profile-1',
				profileName: 'timeout-test',
				audioBase64: createMockWavBase64(100), // Very short audio = short wait time
			};
			service.registerProfile(profile);

			// Only emit speakerDetected, not transcribed (simulates incomplete processing)
			const enrollmentPromise = service.startEnrollment();
			await sleep(50);
			clientEventEmitter.emit('speakerDetected', 'Guest-1');

			await enrollmentPromise;

			// Should have timed out and still mapped the detected speaker
			expect(mockClient.setSpeakerMapping).toHaveBeenCalledWith(
				'Guest-1',
				'profile-1',
				'timeout-test'
			);
		});
	});

	describe('auto-mapping after enrollment', () => {
		it('should auto-map first detected speaker to unmapped profile after enrollment', async () => {
			await service.start();

			const mappedCallback = vi.fn();
			service.on('speakerMapped', mappedCallback);

			const profile = {
				profileId: 'profile-1',
				profileName: 'Testing Profile',
				audioBase64: createMockWavBase64(500), // Short audio - will not detect speaker during enrollment
			};
			service.registerProfile(profile);

			// Enrollment completes without detecting speaker (no events emitted)
			await service.startEnrollment();

			// Verify no mapping happened during enrollment
			expect(mockClient.setSpeakerMapping).not.toHaveBeenCalled();

			// Now simulate real-time transcription with speaker detection
			clientEventEmitter.emit('speakerDetected', 'Guest-1');

			// Should have auto-mapped
			expect(mockClient.setSpeakerMapping).toHaveBeenCalledWith(
				'Guest-1',
				'profile-1',
				'Testing Profile'
			);

			expect(mappedCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					speakerId: 'Guest-1',
					profileId: 'profile-1',
					profileName: 'Testing Profile',
					autoMapped: true,
				})
			);
		});

		it('should auto-map multiple speakers to multiple unmapped profiles in order', async () => {
			await service.start();

			const profile1 = {
				profileId: 'profile-1',
				profileName: 'user-a',
				audioBase64: createMockWavBase64(100), // Very short audio to minimize timeout
			};
			const profile2 = {
				profileId: 'profile-2',
				profileName: 'user-b',
				audioBase64: createMockWavBase64(100), // Very short audio to minimize timeout
			};
			service.registerProfile(profile1);
			service.registerProfile(profile2);

			// Enrollment completes without detecting speakers
			await service.startEnrollment();

			// Simulate two speakers detected in real-time
			clientEventEmitter.emit('speakerDetected', 'Guest-1');
			clientEventEmitter.emit('speakerDetected', 'Guest-2');

			// Should have mapped in FIFO order
			expect(mockClient.setSpeakerMapping).toHaveBeenCalledWith(
				'Guest-1',
				'profile-1',
				'user-a'
			);
			expect(mockClient.setSpeakerMapping).toHaveBeenCalledWith(
				'Guest-2',
				'profile-2',
				'user-b'
			);
		}, 30000); // Increase timeout for multiple profile enrollment

		it('should not auto-map already mapped speakers', async () => {
			await service.start();

			const profile = {
				profileId: 'profile-1',
				profileName: 'Testing Profile',
				audioBase64: createMockWavBase64(100), // Very short audio
			};
			service.registerProfile(profile);

			await service.startEnrollment();

			// First detection - should map
			clientEventEmitter.emit('speakerDetected', 'Guest-1');

			// Verify first mapping happened
			expect(mockClient.setSpeakerMapping).toHaveBeenCalledTimes(1);
			expect(mockClient.setSpeakerMapping).toHaveBeenCalledWith(
				'Guest-1',
				'profile-1',
				'Testing Profile'
			);

			// Clear mock to verify no additional calls
			vi.mocked(mockClient.setSpeakerMapping).mockClear();

			// Same speaker detected again - should not map again
			clientEventEmitter.emit('speakerDetected', 'Guest-1');

			// Should have no additional mapping calls
			expect(mockClient.setSpeakerMapping).toHaveBeenCalledTimes(0);
		});
	});
});

/**
 * Helper to create a mock WAV file in base64 format
 * Creates a valid WAV header followed by silence data
 */
function createMockWavBase64(durationMs: number): string {
	// 16kHz, 16-bit mono = 32000 bytes per second
	const bytesPerSecond = 32000;
	const dataSize = Math.floor((durationMs / 1000) * bytesPerSecond);

	// Create WAV header (44 bytes)
	const header = Buffer.alloc(44);

	// RIFF header
	header.write('RIFF', 0);
	header.writeUInt32LE(36 + dataSize, 4);
	header.write('WAVE', 8);

	// fmt chunk
	header.write('fmt ', 12);
	header.writeUInt32LE(16, 16); // chunk size
	header.writeUInt16LE(1, 20); // audio format (PCM)
	header.writeUInt16LE(1, 22); // num channels
	header.writeUInt32LE(16000, 24); // sample rate
	header.writeUInt32LE(32000, 28); // byte rate
	header.writeUInt16LE(2, 32); // block align
	header.writeUInt16LE(16, 34); // bits per sample

	// data chunk
	header.write('data', 36);
	header.writeUInt32LE(dataSize, 40);

	// Create audio data (silence)
	const audioData = Buffer.alloc(dataSize);

	// Combine header and data
	const wav = Buffer.concat([header, audioData]);

	return wav.toString('base64');
}

/**
 * Helper to sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
