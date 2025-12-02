/**
 * Mock Speech Service for development without Azure credentials
 * Simulates Azure Speech Service responses for local development
 */

import type {
	SessionId,
	SpeakerMapping,
	Utterance,
} from '@speaker-diarization/core';
import type { DiarizationClient } from '@speaker-diarization/speech-client';

/**
 * Mock speaker IDs that simulate Azure's response
 */
const MOCK_SPEAKER_IDS = [
	'mock-speaker-001',
	'mock-speaker-002',
	'mock-speaker-003',
	'mock-speaker-004',
	'mock-speaker-005',
];

/**
 * Simulated delay to mimic network latency
 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a mock Azure speaker ID
 */
function generateMockSpeakerId(index: number): string {
	return MOCK_SPEAKER_IDS[index % MOCK_SPEAKER_IDS.length] ?? `mock-speaker-${index}`;
}

/**
 * Mock implementation of profile registration
 * Simulates the Azure Speech Service voice profile enrollment
 */
export async function mockRegisterProfile(
	_sessionId: SessionId,
	profileIndex: number
): Promise<{ azureSpeakerId: string; registeredAt: string }> {
	// Simulate network delay (300-800ms)
	await delay(300 + Math.random() * 500);

	return {
		azureSpeakerId: generateMockSpeakerId(profileIndex),
		registeredAt: new Date().toISOString(),
	};
}

/**
 * Mock implementation of real-time recognition
 * Generates fake utterances for testing the UI
 */
export function createMockRecognitionStream(
	speakerMappings: SpeakerMapping[],
	onUtterance: (utterance: Omit<Utterance, 'id' | 'recognizedAt'>) => void
): { start: () => void; stop: () => void } {
	let isRunning = false;
	let timeoutId: NodeJS.Timeout | null = null;

	const mockPhrases = [
		'こんにちは、本日はお集まりいただきありがとうございます。',
		'はい、それでは会議を始めましょう。',
		'この件について、何かご意見はありますか？',
		'私からは特にありません。',
		'では、次の議題に移りましょう。',
		'承知しました。',
		'その点については、もう少し検討が必要だと思います。',
		'なるほど、おっしゃる通りですね。',
		'スケジュールはいかがでしょうか？',
		'来週の金曜日までに完了できると思います。',
	];

	let phraseIndex = 0;
	let currentOffset = 0;

	function generateNextUtterance() {
		if (!isRunning || speakerMappings.length === 0) return;

		const speakerIndex = Math.floor(Math.random() * speakerMappings.length);
		const speaker = speakerMappings[speakerIndex];
		const phrase = mockPhrases[phraseIndex % mockPhrases.length] ?? '...';
		const duration = 1 + Math.random() * 3; // 1-4 seconds

		if (speaker) {
			onUtterance({
				sessionId: speaker.sessionId,
				azureSpeakerId: speaker.azureSpeakerId ?? 'unknown',
				speakerName: speaker.displayName,
				text: phrase,
				startOffsetSeconds: currentOffset,
				endOffsetSeconds: currentOffset + duration,
				durationSeconds: duration,
				confidence: 0.85 + Math.random() * 0.15, // 0.85-1.0
			});
		}

		currentOffset += duration + 0.5; // Add pause between utterances
		phraseIndex++;

		// Schedule next utterance (2-5 seconds)
		const nextDelay = 2000 + Math.random() * 3000;
		timeoutId = setTimeout(generateNextUtterance, nextDelay);
	}

	return {
		start() {
			isRunning = true;
			currentOffset = 0;
			phraseIndex = 0;
			// Start after a short delay
			timeoutId = setTimeout(generateNextUtterance, 1000);
		},
		stop() {
			isRunning = false;
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
		},
	};
}

/**
 * Check if mock mode is enabled
 */
export function isMockMode(): boolean {
	// Explicitly enabled via environment variable
	if (process.env.MOCK_AZURE === 'true') {
		return true;
	}

	// Auto-enable in development if Azure credentials are missing
	const hasSpeechKey = Boolean(process.env.SPEECH_KEY);
	const hasSpeechEndpoint = Boolean(process.env.SPEECH_ENDPOINT);

	if (process.env.NODE_ENV === 'development' && (!hasSpeechKey || !hasSpeechEndpoint)) {
		return true;
	}

	return false;
}

/**
 * Log mock mode status on startup
 */
export function logMockModeStatus(): void {
	if (isMockMode()) {
		console.log('🎭 Running in MOCK MODE - Azure Speech Service is simulated');
		console.log('   Set SPEECH_KEY and SPEECH_ENDPOINT to use real Azure services');
	} else {
		console.log('🔌 Connected to Azure Speech Service');
	}
}

/**
 * Mock DiarizationClient for development without Azure credentials
 * Implements the same interface as the real DiarizationClient
 */
export function createMockDiarizationClient(_sessionId: string): DiarizationClient {
	return new MockDiarizationClient() as unknown as DiarizationClient;
}

type EventCallback = (...args: unknown[]) => void;

interface MockTranscriptionResult {
	result: {
		text: string;
		speakerId: string;
		offset: number;
		duration: number;
		reason: number;
	};
}

/**
 * Mock DiarizationClient that simulates Azure Speech Service
 */
class MockDiarizationClient {
	private eventListeners: Map<string, EventCallback[]> = new Map();
	private speakerMappings: Map<string, { profileId: string; displayName: string }> = new Map();
	private _isTranscribing = false;
	private intervalId: NodeJS.Timeout | null = null;
	private phraseIndex = 0;
	private currentOffset = 0;

	private mockPhrases = [
		'こんにちは、本日はお集まりいただきありがとうございます。',
		'はい、それでは会議を始めましょう。',
		'この件について、何かご意見はありますか？',
		'私からは特にありません。',
		'では、次の議題に移りましょう。',
		'承知しました。',
		'その点については、もう少し検討が必要だと思います。',
		'なるほど、おっしゃる通りですね。',
		'スケジュールはいかがでしょうか？',
		'来週の金曜日までに完了できると思います。',
	];

	get isTranscribing(): boolean {
		return this._isTranscribing;
	}

	async enrollVoiceProfile(profileId: string, _audioData: Buffer): Promise<{ profileId: string; speakerId: string }> {
		await delay(300 + Math.random() * 500);
		const speakerId = `Guest-${this.speakerMappings.size + 1}`;
		return { profileId, speakerId };
	}

	async startTranscription(): Promise<void> {
		this._isTranscribing = true;
		this.phraseIndex = 0;
		this.currentOffset = 0;

		// Emit session started
		this.emit('sessionStarted', {});

		// Start generating mock transcriptions
		this.intervalId = setInterval(() => {
			if (!this._isTranscribing) return;

			const speakerIndex = (this.phraseIndex % 2) + 1;
			const speakerId = `Guest-${speakerIndex}`;
			const phrase = this.mockPhrases[this.phraseIndex % this.mockPhrases.length];
			const duration = 1000 + Math.random() * 2000;

			// Emit interim result
			const interimResult: MockTranscriptionResult = {
				result: {
					// biome-ignore lint/style/useTemplate: <explanation>
					text: phrase?.substring(0, Math.floor((phrase?.length || 0) / 2)) + '...',
					speakerId,
					offset: this.currentOffset,
					duration: duration / 2,
					reason: 1,
				},
			};
			this.emit('transcribing', interimResult);

			// Emit final result after a short delay
			setTimeout(() => {
				if (!this._isTranscribing) return;

				// Check if this is a new speaker
				if (!this.speakerMappings.has(speakerId)) {
					this.emit('speakerDetected', speakerId);
				}

				const finalResult: MockTranscriptionResult = {
					result: {
						text: phrase || '',
						speakerId,
						offset: this.currentOffset,
						duration,
						reason: 1,
					},
				};
				this.emit('transcribed', finalResult);
			}, 500);

			this.currentOffset += duration + 500;
			this.phraseIndex++;
		}, 3000);
	}

	async stopTranscription(): Promise<void> {
		this._isTranscribing = false;
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
		this.emit('sessionStopped', {});
	}

	pushAudioChunk(_chunk: Uint8Array): void {
		// Mock: audio is not actually processed
	}

	validateAudioFormat(format: { sampleRate: number; bitsPerSample: number; channels: number }): boolean {
		return format.sampleRate === 16000 && format.bitsPerSample === 16 && format.channels === 1;
	}

	getEnrolledProfiles(): string[] {
		return Array.from(this.speakerMappings.keys());
	}

	setSpeakerMapping(azureSpeakerId: string, profileId: string, displayName: string): void {
		this.speakerMappings.set(azureSpeakerId, { profileId, displayName });
	}

	getSpeakerName(azureSpeakerId: string): string {
		return this.speakerMappings.get(azureSpeakerId)?.displayName ?? 'Unknown Speaker';
	}

	on(event: string, callback: EventCallback): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, []);
		}
		this.eventListeners.get(event)?.push(callback);
	}

	off(event: string, callback: EventCallback): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			const index = listeners.indexOf(callback);
			if (index !== -1) {
				listeners.splice(index, 1);
			}
		}
	}

	private emit(event: string, ...args: unknown[]): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			for (const callback of listeners) {
				callback(...args);
			}
		}
	}

	async dispose(): Promise<void> {
		await this.stopTranscription();
		this.eventListeners.clear();
		this.speakerMappings.clear();
	}
}
