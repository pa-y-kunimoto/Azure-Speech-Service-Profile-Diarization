/**
 * Unit tests for SpeechService (Azure SDK wrapper)
 * TDD: Write tests first, verify Azure SDK integration
 *
 * Tests:
 * - DiarizationClient initialization
 * - Voice profile enrollment
 * - ConversationTranscriber integration
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Azure Speech SDK
vi.mock('microsoft-cognitiveservices-speech-sdk', () => {
	const VoiceProfileClientMock = vi.fn().mockImplementation(() => ({
		createProfileAsync: vi.fn((_type, _locale, callback) =>
			callback({ profileId: 'voice-profile-001' })
		),
		enrollProfileAsync: vi.fn((_profile, _audioConfig, callback) =>
			callback({ enrollmentsCount: 1 })
		),
		deleteProfileAsync: vi.fn((profile, callback) => callback({})),
	}));

	const mockExports = {
		SpeechConfig: {
			fromSubscription: vi.fn().mockReturnValue({
				speechRecognitionLanguage: '',
				setProfanity: vi.fn(),
			}),
			fromEndpoint: vi.fn().mockReturnValue({
				speechRecognitionLanguage: '',
				setProfanity: vi.fn(),
			}),
		},
		AudioConfig: {
			fromWavFileInput: vi.fn().mockReturnValue({}),
			fromDefaultMicrophoneInput: vi.fn().mockReturnValue({}),
			fromStreamInput: vi.fn().mockReturnValue({}),
		},
		AudioStreamFormat: {
			getWaveFormatPCM: vi.fn().mockReturnValue({}),
		},
		AudioInputStream: {
			createPushStream: vi.fn().mockReturnValue({
				write: vi.fn(),
				close: vi.fn(),
			}),
		},
		SpeakerRecognizer: vi.fn().mockImplementation(() => ({
			recognizeOnceAsync: vi.fn((callback) => callback({ speakerId: 'mock-speaker-001' })),
		})),
		VoiceProfileClient: VoiceProfileClientMock,
		VoiceProfile: vi.fn().mockImplementation((id) => ({
			profileId: id,
		})),
		VoiceProfileType: {
			TextIndependentIdentification: 1,
			TextIndependentVerification: 2,
		},
		ConversationTranscriber: vi.fn().mockImplementation(() => ({
			startTranscribingAsync: vi.fn((success) => success()),
			stopTranscribingAsync: vi.fn((success) => success()),
			transcribing: { connect: vi.fn() },
			transcribed: { connect: vi.fn() },
			canceled: { connect: vi.fn() },
			sessionStarted: { connect: vi.fn() },
			sessionStopped: { connect: vi.fn() },
		})),
		SpeakerIdentificationModel: {
			fromProfiles: vi.fn().mockReturnValue({}),
		},
		ResultReason: {
			RecognizedSpeech: 0,
			NoMatch: 1,
			Canceled: 2,
		},
		CancellationReason: {
			Error: 0,
			EndOfStream: 1,
		},
	};

	return {
		default: mockExports,
		...mockExports,
	};
});

// Import after mocking
import { DiarizationClient } from '../../src/diarizationClient.js';

describe('SpeechService / DiarizationClient', () => {
	let client: DiarizationClient;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('initialization', () => {
		it('should create client with subscription key and region', () => {
			client = new DiarizationClient({
				subscriptionKey: 'test-key',
				region: 'eastus',
			});

			expect(client).toBeDefined();
		});

		it('should create client with endpoint URL', () => {
			client = new DiarizationClient({
				endpoint: 'https://eastus.api.cognitive.microsoft.com',
				subscriptionKey: 'test-key',
			});

			expect(client).toBeDefined();
		});

		it('should throw error when neither region nor endpoint provided', () => {
			expect(() => {
				new DiarizationClient({
					subscriptionKey: 'test-key',
				});
			}).toThrow();
		});

		it('should throw error when subscription key is missing', () => {
			expect(() => {
				new DiarizationClient({
					region: 'eastus',
				});
			}).toThrow();
		});
	});

	describe('voice profile enrollment', () => {
		beforeEach(() => {
			client = new DiarizationClient({
				subscriptionKey: 'test-key',
				region: 'eastus',
			});
		});

		it('should enroll voice profile from audio data', async () => {
			const audioData = Buffer.from('fake-wav-data');
			const result = await client.enrollVoiceProfile('profile-1', audioData);

			expect(result).toBeDefined();
			expect(result.profileId).toBeDefined();
		});

		it('should return speaker ID after enrollment', async () => {
			const audioData = Buffer.from('fake-wav-data');
			const result = await client.enrollVoiceProfile('profile-1', audioData);

			expect(result.speakerId).toBeDefined();
			// New implementation uses Guest-N format
			expect(result.speakerId).toMatch(/^Guest-\d+$/);
		});

		it('should store profile locally for reference', async () => {
			const audioData = Buffer.from('fake-wav-data');
			await client.enrollVoiceProfile('profile-1', audioData);

			const profile = client.getProfile('profile-1');
			expect(profile).toBeDefined();
			expect(profile?.profileId).toBe('profile-1');
		});
	});

	describe('real-time transcription', () => {
		beforeEach(() => {
			client = new DiarizationClient({
				subscriptionKey: 'test-key',
				region: 'eastus',
			});
		});

		it('should start transcription session', async () => {
			await client.startTranscription();

			// Verify session started
			expect(client.isTranscribing).toBe(true);
		});

		it('should stop transcription session', async () => {
			await client.startTranscription();
			await client.stopTranscription();

			expect(client.isTranscribing).toBe(false);
		});

		it('should handle transcription callbacks', async () => {
			const onTranscribing = vi.fn();
			const onTranscribed = vi.fn();

			client.on('transcribing', onTranscribing);
			client.on('transcribed', onTranscribed);

			await client.startTranscription();

			// Callbacks should be registered (we'll trigger them in integration tests)
			expect(client.hasListeners()).toBe(true);
		});
	});

	describe('audio processing', () => {
		beforeEach(() => {
			client = new DiarizationClient({
				subscriptionKey: 'test-key',
				region: 'eastus',
			});
		});

		it('should accept audio chunks for processing', async () => {
			await client.startTranscription();

			const audioChunk = new Uint8Array(1024);
			expect(() => client.pushAudioChunk(audioChunk)).not.toThrow();
		});

		it('should validate audio format', () => {
			// Audio should be 16kHz, 16-bit, mono PCM
			const validFormat = client.validateAudioFormat({
				sampleRate: 16000,
				bitsPerSample: 16,
				channels: 1,
			});

			expect(validFormat).toBe(true);
		});

		it('should reject invalid audio format', () => {
			// 44.1kHz is not supported
			const invalidFormat = client.validateAudioFormat({
				sampleRate: 44100,
				bitsPerSample: 16,
				channels: 1,
			});

			expect(invalidFormat).toBe(false);
		});
	});

	describe('speaker identification', () => {
		beforeEach(() => {
			client = new DiarizationClient({
				subscriptionKey: 'test-key',
				region: 'eastus',
			});
		});

		it('should register multiple speaker profiles', async () => {
			await client.enrollVoiceProfile('profile-1', Buffer.from('audio-1'));
			await client.enrollVoiceProfile('profile-2', Buffer.from('audio-2'));

			expect(client.getEnrolledProfiles()).toHaveLength(2);
		});

		it('should map Azure speaker IDs to profile names', () => {
			client.setSpeakerMapping('azure-speaker-001', 'profile-1', '田中さん');
			client.setSpeakerMapping('azure-speaker-002', 'profile-2', '佐藤さん');

			const name = client.getSpeakerName('azure-speaker-001');
			expect(name).toBe('田中さん');
		});

		it('should return unknown for unregistered speaker', () => {
			const name = client.getSpeakerName('unknown-speaker');
			expect(name).toBe('Unknown Speaker');
		});
	});

	describe('cleanup', () => {
		it('should cleanup resources on dispose', async () => {
			client = new DiarizationClient({
				subscriptionKey: 'test-key',
				region: 'eastus',
			});

			await client.startTranscription();
			await client.dispose();

			expect(client.isTranscribing).toBe(false);
			expect(client.getEnrolledProfiles()).toHaveLength(0);
		});
	});
});
