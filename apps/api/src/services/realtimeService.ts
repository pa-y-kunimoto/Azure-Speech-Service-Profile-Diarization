/**
 * RealtimeService - Real-time transcription service
 *
 * Manages the connection between WebSocket and DiarizationClient.
 * Handles transcription events and speaker mapping.
 */

import { EventEmitter } from 'node:events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Utterance data structure
 */
export interface Utterance {
	id: string;
	text: string;
	speakerId: string;
	speakerName: string;
	timestamp: string;
	offsetMs: number;
	confidence: number;
	isFinal: boolean;
}

/**
 * Transcription result from Azure SDK
 */
interface TranscriptionResult {
	result?: {
		text?: string;
		speakerId?: string;
		offset?: number;
		duration?: number;
		reason?: number;
	};
}

type EventCallback = (...args: unknown[]) => void;

/**
 * Real-time transcription service
 *
 * Connects DiarizationClient events to WebSocket output.
 * Manages utterance history and speaker mappings.
 */
export class RealtimeService {
	private client: DiarizationClient;
	private sessionId: string;
	private utterances: Utterance[] = [];
	private eventEmitter = new EventEmitter();
	private startTime = 0;

	// Event handlers stored for cleanup
	private transcribingHandler?: EventCallback;
	private transcribedHandler?: EventCallback;
	private speakerDetectedHandler?: EventCallback;
	private canceledHandler?: EventCallback;

	constructor(client: DiarizationClient, sessionId: string) {
		this.client = client;
		this.sessionId = sessionId;
	}

	/**
	 * Start transcription
	 */
	async start(): Promise<void> {
		this.startTime = Date.now();

		// Set up event handlers
		this.transcribingHandler = (e: unknown) => {
			const event = e as TranscriptionResult;
			if (event.result?.text) {
				const utterance = this.createUtterance(event, false);
				this.eventEmitter.emit('transcribing', utterance);
			}
		};

		this.transcribedHandler = (e: unknown) => {
			const event = e as TranscriptionResult;
			if (event.result?.text) {
				const utterance = this.createUtterance(event, true);
				this.utterances.push(utterance);
				this.eventEmitter.emit('transcribed', utterance);
			}
		};

		this.speakerDetectedHandler = (speakerId: unknown) => {
			this.eventEmitter.emit('speakerDetected', speakerId as string);
		};

		this.canceledHandler = () => {
			this.eventEmitter.emit('error', {
				code: 'RECOGNITION_FAILED',
				message: 'Recognition was canceled',
				recoverable: true,
			});
		};

		// Register handlers
		this.client.on('transcribing', this.transcribingHandler);
		this.client.on('transcribed', this.transcribedHandler);
		this.client.on('speakerDetected', this.speakerDetectedHandler);
		this.client.on('canceled', this.canceledHandler);

		// Start transcription
		await this.client.startTranscription();
	}

	/**
	 * Stop transcription
	 */
	async stop(): Promise<void> {
		// Remove event handlers
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

		// Stop transcription
		await this.client.stopTranscription();
	}

	/**
	 * Create utterance from transcription result
	 */
	private createUtterance(event: TranscriptionResult, isFinal: boolean): Utterance {
		const speakerId = event.result?.speakerId || 'Unknown';
		const offsetMs = event.result?.offset || (Date.now() - this.startTime);

		return {
			id: isFinal ? `final-${uuidv4()}` : `interim-${Date.now()}`,
			text: event.result?.text || '',
			speakerId,
			speakerName: this.client.getSpeakerName(speakerId),
			timestamp: new Date().toISOString(),
			offsetMs,
			confidence: isFinal ? 0.95 : 0.5,
			isFinal,
		};
	}

	/**
	 * Push audio chunk for processing
	 */
	pushAudio(chunk: Buffer): void {
		this.client.pushAudioChunk(new Uint8Array(chunk));
	}

	/**
	 * Map speaker ID to profile
	 */
	mapSpeaker(azureSpeakerId: string, profileId: string, displayName: string): void {
		this.client.setSpeakerMapping(azureSpeakerId, profileId, displayName);
	}

	/**
	 * Get all utterances
	 */
	getUtterances(): Utterance[] {
		return [...this.utterances];
	}

	/**
	 * Get session ID
	 */
	getSessionId(): string {
		return this.sessionId;
	}

	/**
	 * Register event listener
	 *
	 * Events:
	 * - 'transcribing': Interim transcription result
	 * - 'transcribed': Final transcription result
	 * - 'speakerDetected': New speaker detected
	 * - 'error': Error occurred
	 */
	on(event: string, callback: EventCallback): void {
		this.eventEmitter.on(event, callback);
	}

	/**
	 * Remove event listener
	 */
	off(event: string, callback: EventCallback): void {
		this.eventEmitter.off(event, callback);
	}

	/**
	 * Dispose resources
	 */
	async dispose(): Promise<void> {
		await this.stop();
		this.utterances = [];
		this.eventEmitter.removeAllListeners();
	}
}
