/**
 * RealtimeService - Real-time transcription service
 *
 * Manages the connection between WebSocket and DiarizationClient.
 * Handles transcription events and speaker mapping.
 */

import { EventEmitter } from 'node:events';
import type { DiarizationClient } from '@speaker-diarization/speech-client';
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
	/** True if this utterance was extracted from an enrollment audio profile */
	isEnrollment?: boolean;
	/** Profile name if this is an enrollment utterance */
	enrollmentProfileName?: string;
}

/**
 * Profile registration info for speaker learning
 */
export interface ProfileRegistration {
	profileId: string;
	profileName: string;
	audioBase64: string;
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

	// Pending profile registrations - profiles waiting to be matched with Azure speaker IDs
	private pendingProfiles: ProfileRegistration[] = [];
	// Detected speakers that haven't been mapped yet
	private unmappedSpeakers: string[] = [];
	// Speakers that have been mapped (to avoid re-mapping)
	private mappedSpeakerIds: Set<string> = new Set();
	// Flag to indicate if we're in enrollment mode (sending profile audio)
	private isEnrolling = false;
	// Current profile being enrolled (for speaker detection during enrollment)
	private currentEnrollmentProfile: ProfileRegistration | null = null;
	// Speakers detected during current profile enrollment
	private currentEnrollmentSpeakers: Set<string> = new Set();

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
				// During enrollment, track speakers and emit with enrollment flag
				if (this.isEnrolling && event.result.speakerId) {
					this.trackEnrollmentSpeaker(event.result.speakerId);
				}
				const utterance = this.createUtterance(event, false, this.isEnrolling);
				this.eventEmitter.emit('transcribing', utterance);
			}
		};

		this.transcribedHandler = (e: unknown) => {
			const event = e as TranscriptionResult;
			if (event.result?.text) {
				// During enrollment, track speakers and emit with enrollment flag
				if (this.isEnrolling && event.result.speakerId) {
					this.trackEnrollmentSpeaker(event.result.speakerId);
				}
				const utterance = this.createUtterance(event, true, this.isEnrolling);
				this.utterances.push(utterance);
				this.eventEmitter.emit('transcribed', utterance);
			}
		};

		this.speakerDetectedHandler = (speakerId: unknown) => {
			const id = speakerId as string;
			// Skip 'Unknown' speakers - they cannot be mapped
			if (id === 'Unknown') {
				return;
			}
			// Track unmapped speakers
			if (!this.unmappedSpeakers.includes(id)) {
				this.unmappedSpeakers.push(id);
			}
			// Track speaker during enrollment
			if (this.isEnrolling) {
				this.trackEnrollmentSpeaker(id);
			}
			this.eventEmitter.emit('speakerDetected', id);
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
	private createUtterance(
		event: TranscriptionResult,
		isFinal: boolean,
		isEnrollment = false
	): Utterance {
		const speakerId = event.result?.speakerId || 'Unknown';
		const offsetMs = event.result?.offset || Date.now() - this.startTime;

		const utterance: Utterance = {
			id: isFinal ? `final-${uuidv4()}` : `interim-${Date.now()}`,
			text: event.result?.text || '',
			speakerId,
			speakerName: this.client.getSpeakerName(speakerId),
			timestamp: new Date().toISOString(),
			offsetMs,
			confidence: isFinal ? 0.95 : 0.5,
			isFinal,
		};

		// Add enrollment info if this is from profile audio
		if (isEnrollment) {
			utterance.isEnrollment = true;
			utterance.enrollmentProfileName =
				this.currentEnrollmentProfile?.profileName || 'プロフィール音声';
		}

		return utterance;
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
		// Remove from unmapped speakers
		this.unmappedSpeakers = this.unmappedSpeakers.filter((id) => id !== azureSpeakerId);
	}

	/**
	 * Register a profile for speaker enrollment
	 * The profile audio will be sent to Azure to learn the speaker's voice
	 */
	registerProfile(profile: ProfileRegistration): void {
		this.pendingProfiles.push(profile);
		console.log(`Profile registered for enrollment: ${profile.profileName} (${profile.profileId})`);
	}

	/**
	 * Start enrollment process - sends profile audio to learn speakers
	 * Should be called after transcription is started
	 *
	 * For each profile:
	 * 1. Set current enrollment profile
	 * 2. Send the profile's audio
	 * 3. Collect all speakerIds detected during that audio
	 * 4. Map all detected speakerIds to that profile
	 */
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Reviewed
	async startEnrollment(): Promise<void> {
		if (this.pendingProfiles.length === 0) {
			console.log('No profiles to enroll');
			return;
		}

		console.log(`Starting enrollment for ${this.pendingProfiles.length} profile(s)`);
		this.isEnrolling = true;
		let totalMapped = 0;

		// Process each profile sequentially
		for (const profile of this.pendingProfiles) {
			console.log(`Enrolling profile: ${profile.profileName}`);

			// Set current profile and reset speakers collection
			this.currentEnrollmentProfile = profile;
			this.currentEnrollmentSpeakers.clear();

			try {
				// Decode base64 audio (WAV format with 44-byte header)
				const audioBuffer = Buffer.from(profile.audioBase64, 'base64');
				console.log(
					`Profile "${profile.profileName}" total buffer size: ${audioBuffer.length} bytes`
				);

				// Skip WAV header (44 bytes) to get raw PCM data
				const WAV_HEADER_SIZE = 44;
				if (audioBuffer.length <= WAV_HEADER_SIZE) {
					console.error(
						`Profile "${profile.profileName}" audio buffer too small: ${audioBuffer.length} bytes`
					);
					continue;
				}

				// Extract audio data after WAV header
				const audioData = audioBuffer.subarray(WAV_HEADER_SIZE);

				// Calculate audio duration for adaptive wait time
				// Assuming 16kHz, 16-bit mono: 32000 bytes per second
				const audioDurationMs = (audioData.length / 32000) * 1000;
				console.log(
					`Profile "${profile.profileName}" audio duration: ~${Math.round(audioDurationMs)}ms, PCM data size: ${audioData.length} bytes`
				);

				// Send audio in chunks to simulate real-time streaming
				const chunkSize = 3200; // 100ms of 16kHz 16-bit mono audio
				let chunkCount = 0;
				for (let offset = 0; offset < audioData.length; offset += chunkSize) {
					const chunk = audioData.subarray(offset, Math.min(offset + chunkSize, audioData.length));
					this.pushAudio(chunk);
					chunkCount++;

					// Small delay to allow processing (reduced for faster enrollment)
					await this.sleep(20);
				}
				console.log(`Profile "${profile.profileName}" sent ${chunkCount} audio chunks`);

				// Wait for Azure to process and detect speaker
				// Use adaptive wait time: minimum 2 seconds, or at least audio duration
				const waitTime = Math.max(2000, Math.min(audioDurationMs, 5000));
				console.log(
					`Waiting ${waitTime}ms for Azure to process profile "${profile.profileName}"...`
				);
				await this.sleep(waitTime);

				// Map all speakers detected during this profile's audio
				const detectedSpeakers = Array.from(this.currentEnrollmentSpeakers);
				console.log(
					`Profile "${profile.profileName}" detected ${detectedSpeakers.length} speaker(s): ${detectedSpeakers.join(', ') || 'none'}`
				);

				if (detectedSpeakers.length > 0) {
					for (const speakerId of detectedSpeakers) {
						if (!this.mappedSpeakerIds.has(speakerId)) {
							this.mapSpeaker(speakerId, profile.profileId, profile.profileName);
							this.mappedSpeakerIds.add(speakerId);
							totalMapped++;

							// Emit speaker mapped event
							this.eventEmitter.emit('speakerMapped', {
								speakerId,
								profileId: profile.profileId,
								profileName: profile.profileName,
							});
							console.log(`Mapped speaker ${speakerId} to profile "${profile.profileName}"`);
						}
					}
				} else {
					console.log(`Profile "${profile.profileName}" - no speakers detected during enrollment`);
					// Emit a warning event so the client knows this profile wasn't mapped
					this.eventEmitter.emit('enrollmentWarning', {
						profileId: profile.profileId,
						profileName: profile.profileName,
						message:
							'プロフィール音声からスピーカーを検出できませんでした。音声が短すぎるか、明瞭でない可能性があります。',
					});
				}

				// Short pause between profiles
				await this.sleep(500);
			} catch (error) {
				console.error(`Error enrolling profile ${profile.profileName}:`, error);
			}
		}

		// Clear current enrollment state
		this.currentEnrollmentProfile = null;
		this.currentEnrollmentSpeakers.clear();
		this.isEnrolling = false;

		console.log(
			`Enrollment completed. Mapped ${totalMapped} speaker(s) across ${this.pendingProfiles.length} profile(s)`
		);

		// Emit enrollment complete event
		this.eventEmitter.emit('enrollmentComplete', {
			enrolled: this.pendingProfiles.length,
			mapped: totalMapped,
		});
	}

	/**
	 * Track speaker detected during enrollment
	 * Called when a speakerId is detected while processing profile audio
	 */
	private trackEnrollmentSpeaker(speakerId: string): void {
		// Skip 'Unknown' speakers - they cannot be mapped
		if (speakerId === 'Unknown') {
			return;
		}
		if (this.isEnrolling && this.currentEnrollmentProfile) {
			// Add to current enrollment speakers (only if not already globally mapped)
			if (!this.mappedSpeakerIds.has(speakerId)) {
				this.currentEnrollmentSpeakers.add(speakerId);
				console.log(
					`Detected speaker ${speakerId} during enrollment of "${this.currentEnrollmentProfile.profileName}"`
				);
			}
		}
	}

	/**
	 * Helper to sleep for a given duration
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
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
		this.pendingProfiles = [];
		this.unmappedSpeakers = [];
		this.mappedSpeakerIds.clear();
		this.currentEnrollmentProfile = null;
		this.currentEnrollmentSpeakers.clear();
		this.eventEmitter.removeAllListeners();
	}
}
