/**
 * Real-time Recognition Integration Tests
 *
 * Tests for the integration between WebSocket server and Azure Speech Service.
 * Uses mocked Azure SDK to test the full transcription flow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock DiarizationClient interface matching speech-client package
interface MockDiarizationClient {
	enrollVoiceProfile(profileId: string, audioData: Buffer): Promise<{ profileId: string; speakerId: string }>;
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

// Mock Azure SDK transcription result
interface MockTranscriptionResult {
	result: {
		text: string;
		speakerId: string;
		offset: number;
		duration: number;
		reason: number;
	};
}

// RealtimeService class (to be implemented)
class RealtimeService {
	private client: MockDiarizationClient;
	private sessionId: string;
	private utterances: Array<{
		id: string;
		text: string;
		speakerId: string;
		speakerName: string;
		timestamp: string;
		offsetMs: number;
		confidence: number;
		isFinal: boolean;
	}> = [];
	private eventEmitter = new EventEmitter();
	private transcribingHandler?: (...args: unknown[]) => void;
	private transcribedHandler?: (...args: unknown[]) => void;
	private speakerDetectedHandler?: (...args: unknown[]) => void;
	private canceledHandler?: (...args: unknown[]) => void;

	constructor(client: MockDiarizationClient, sessionId: string) {
		this.client = client;
		this.sessionId = sessionId;
	}

	async start(): Promise<void> {
		// Set up event handlers
		this.transcribingHandler = (e: unknown) => {
			const event = e as MockTranscriptionResult;
			if (event.result?.text) {
				const utterance = {
					id: `interim-${Date.now()}`,
					text: event.result.text,
					speakerId: event.result.speakerId || 'Unknown',
					speakerName: this.client.getSpeakerName(event.result.speakerId || 'Unknown'),
					timestamp: new Date().toISOString(),
					offsetMs: event.result.offset || 0,
					confidence: 0.5,
					isFinal: false,
				};
				this.eventEmitter.emit('transcribing', utterance);
			}
		};

		this.transcribedHandler = (e: unknown) => {
			const event = e as MockTranscriptionResult;
			if (event.result?.text) {
				const utterance = {
					id: `final-${Date.now()}-${this.utterances.length}`,
					text: event.result.text,
					speakerId: event.result.speakerId || 'Unknown',
					speakerName: this.client.getSpeakerName(event.result.speakerId || 'Unknown'),
					timestamp: new Date().toISOString(),
					offsetMs: event.result.offset || 0,
					confidence: 0.95,
					isFinal: true,
				};
				this.utterances.push(utterance);
				this.eventEmitter.emit('transcribed', utterance);
			}
		};

		this.speakerDetectedHandler = (speakerId: unknown) => {
			this.eventEmitter.emit('speakerDetected', speakerId as string);
		};

		this.canceledHandler = (e: unknown) => {
			this.eventEmitter.emit('error', {
				code: 'RECOGNITION_FAILED',
				message: 'Recognition was canceled',
				recoverable: true,
			});
		};

		this.client.on('transcribing', this.transcribingHandler);
		this.client.on('transcribed', this.transcribedHandler);
		this.client.on('speakerDetected', this.speakerDetectedHandler);
		this.client.on('canceled', this.canceledHandler);

		await this.client.startTranscription();
	}

	async stop(): Promise<void> {
		if (this.transcribingHandler) {
			this.client.off('transcribing', this.transcribingHandler);
		}
		if (this.transcribedHandler) {
			this.client.off('transcribed', this.transcribedHandler);
		}
		if (this.speakerDetectedHandler) {
			this.client.off('speakerDetected', this.speakerDetectedHandler);
		}
		if (this.canceledHandler) {
			this.client.off('canceled', this.canceledHandler);
		}

		await this.client.stopTranscription();
	}

	pushAudio(chunk: Buffer): void {
		this.client.pushAudioChunk(new Uint8Array(chunk));
	}

	mapSpeaker(azureSpeakerId: string, profileId: string, displayName: string): void {
		this.client.setSpeakerMapping(azureSpeakerId, profileId, displayName);
	}

	getUtterances(): typeof this.utterances {
		return [...this.utterances];
	}

	getSessionId(): string {
		return this.sessionId;
	}

	on(event: string, callback: (...args: unknown[]) => void): void {
		this.eventEmitter.on(event, callback);
	}

	off(event: string, callback: (...args: unknown[]) => void): void {
		this.eventEmitter.off(event, callback);
	}
}

describe('RealtimeService', () => {
	let service: RealtimeService;
	let mockClient: MockDiarizationClient;
	let clientEventEmitter: EventEmitter;
	const testSessionId = 'test-session-456';

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

		service = new RealtimeService(mockClient, testSessionId);
	});

	afterEach(() => {
		clientEventEmitter.removeAllListeners();
		vi.clearAllMocks();
	});

	describe('initialization', () => {
		it('should initialize with session ID', () => {
			expect(service.getSessionId()).toBe(testSessionId);
		});

		it('should start with empty utterances', () => {
			expect(service.getUtterances()).toEqual([]);
		});
	});

	describe('transcription lifecycle', () => {
		it('should start transcription and register event handlers', async () => {
			await service.start();

			expect(mockClient.startTranscription).toHaveBeenCalled();
			expect(mockClient.on).toHaveBeenCalledWith('transcribing', expect.any(Function));
			expect(mockClient.on).toHaveBeenCalledWith('transcribed', expect.any(Function));
			expect(mockClient.on).toHaveBeenCalledWith('speakerDetected', expect.any(Function));
			expect(mockClient.on).toHaveBeenCalledWith('canceled', expect.any(Function));
		});

		it('should stop transcription and remove event handlers', async () => {
			await service.start();
			await service.stop();

			expect(mockClient.stopTranscription).toHaveBeenCalled();
			expect(mockClient.off).toHaveBeenCalledWith('transcribing', expect.any(Function));
			expect(mockClient.off).toHaveBeenCalledWith('transcribed', expect.any(Function));
		});
	});

	describe('audio processing', () => {
		it('should push audio chunks to client', async () => {
			await service.start();

			const audioData = Buffer.from([0x00, 0x01, 0x02, 0x03]);
			service.pushAudio(audioData);

			expect(mockClient.pushAudioChunk).toHaveBeenCalledWith(new Uint8Array(audioData));
		});
	});

	describe('transcription events', () => {
		it('should emit transcribing event for interim results', async () => {
			await service.start();

			const transcribingCallback = vi.fn();
			service.on('transcribing', transcribingCallback);

			// Simulate interim transcription result
			clientEventEmitter.emit('transcribing', {
				result: {
					text: '今日は',
					speakerId: 'Guest-1',
					offset: 1000,
					duration: 500,
					reason: 1,
				},
			});

			expect(transcribingCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					text: '今日は',
					speakerId: 'Guest-1',
					isFinal: false,
				})
			);
		});

		it('should emit transcribed event for final results', async () => {
			await service.start();

			const transcribedCallback = vi.fn();
			service.on('transcribed', transcribedCallback);

			// Simulate final transcription result
			clientEventEmitter.emit('transcribed', {
				result: {
					text: '今日は良い天気です',
					speakerId: 'Guest-1',
					offset: 1000,
					duration: 2000,
					reason: 1,
				},
			});

			expect(transcribedCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					text: '今日は良い天気です',
					speakerId: 'Guest-1',
					isFinal: true,
					confidence: 0.95,
				})
			);
		});

		it('should store final utterances', async () => {
			await service.start();

			clientEventEmitter.emit('transcribed', {
				result: {
					text: 'First utterance',
					speakerId: 'Guest-1',
					offset: 0,
					duration: 1000,
					reason: 1,
				},
			});

			clientEventEmitter.emit('transcribed', {
				result: {
					text: 'Second utterance',
					speakerId: 'Guest-2',
					offset: 1000,
					duration: 1500,
					reason: 1,
				},
			});

			const utterances = service.getUtterances();
			expect(utterances).toHaveLength(2);
			expect(utterances[0].text).toBe('First utterance');
			expect(utterances[1].text).toBe('Second utterance');
		});

		it('should emit speakerDetected event for new speakers', async () => {
			await service.start();

			const speakerCallback = vi.fn();
			service.on('speakerDetected', speakerCallback);

			clientEventEmitter.emit('speakerDetected', 'Guest-3');

			expect(speakerCallback).toHaveBeenCalledWith('Guest-3');
		});

		it('should emit error event on cancellation', async () => {
			await service.start();

			const errorCallback = vi.fn();
			service.on('error', errorCallback);

			clientEventEmitter.emit('canceled', { reason: 'EndOfStream' });

			expect(errorCallback).toHaveBeenCalledWith({
				code: 'RECOGNITION_FAILED',
				message: 'Recognition was canceled',
				recoverable: true,
			});
		});
	});

	describe('speaker mapping', () => {
		it('should map speaker to profile', async () => {
			await service.start();

			service.mapSpeaker('Guest-1', 'profile-123', '田中さん');

			expect(mockClient.setSpeakerMapping).toHaveBeenCalledWith(
				'Guest-1',
				'profile-123',
				'田中さん'
			);
		});

		it('should use speaker name in transcription', async () => {
			(mockClient.getSpeakerName as ReturnType<typeof vi.fn>).mockReturnValue('田中さん');

			await service.start();

			const transcribedCallback = vi.fn();
			service.on('transcribed', transcribedCallback);

			clientEventEmitter.emit('transcribed', {
				result: {
					text: 'こんにちは',
					speakerId: 'Guest-1',
					offset: 0,
					duration: 1000,
					reason: 1,
				},
			});

			expect(transcribedCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					speakerName: '田中さん',
				})
			);
		});
	});

	describe('multiple speakers', () => {
		it('should handle utterances from multiple speakers', async () => {
			(mockClient.getSpeakerName as ReturnType<typeof vi.fn>)
				.mockReturnValueOnce('田中さん')
				.mockReturnValueOnce('鈴木さん')
				.mockReturnValueOnce('田中さん');

			await service.start();

			clientEventEmitter.emit('transcribed', {
				result: { text: '私は田中です', speakerId: 'Guest-1', offset: 0, duration: 1000, reason: 1 },
			});

			clientEventEmitter.emit('transcribed', {
				result: { text: '私は鈴木です', speakerId: 'Guest-2', offset: 1000, duration: 1000, reason: 1 },
			});

			clientEventEmitter.emit('transcribed', {
				result: { text: 'よろしくお願いします', speakerId: 'Guest-1', offset: 2000, duration: 1500, reason: 1 },
			});

			const utterances = service.getUtterances();
			expect(utterances).toHaveLength(3);
			expect(utterances[0].speakerName).toBe('田中さん');
			expect(utterances[1].speakerName).toBe('鈴木さん');
			expect(utterances[2].speakerName).toBe('田中さん');
		});
	});

	describe('error handling', () => {
		it('should handle transcription start failure', async () => {
			(mockClient.startTranscription as ReturnType<typeof vi.fn>).mockRejectedValue(
				new Error('Azure connection failed')
			);

			await expect(service.start()).rejects.toThrow('Azure connection failed');
		});

		it('should handle transcription stop failure', async () => {
			await service.start();

			(mockClient.stopTranscription as ReturnType<typeof vi.fn>).mockRejectedValue(
				new Error('Stop failed')
			);

			await expect(service.stop()).rejects.toThrow('Stop failed');
		});
	});
});
