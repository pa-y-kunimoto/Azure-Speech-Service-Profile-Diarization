/**
 * Mock Speech Service for development without Azure credentials
 * Simulates Azure Speech Service responses for local development
 */

import type {
	DiarizationSession,
	SessionId,
	SpeakerMapping,
	Utterance,
	VoiceProfile,
} from '@speaker-diarization/core';

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
