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
	// Profiles that have been enrolled but not yet mapped to a speakerId
	private unmappedProfiles: ProfileRegistration[] = [];
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
	// Flag to enable auto-mapping of detected speakers to unmapped profiles
	private autoMappingEnabled = false;

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
			// During enrollment, always track speakers (even without text)
			if (this.isEnrolling && event.result?.speakerId) {
				this.trackEnrollmentSpeaker(event.result.speakerId);
			}
			if (event.result?.text) {
				const utterance = this.createUtterance(event, false, this.isEnrolling);
				this.eventEmitter.emit('transcribing', utterance);
			}
		};

		this.transcribedHandler = (e: unknown) => {
			const event = e as TranscriptionResult;
			// During enrollment, always track speakers (even without text)
			if (this.isEnrolling && event.result?.speakerId) {
				this.trackEnrollmentSpeaker(event.result.speakerId);
			}
			if (event.result?.text) {
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
			// Auto-map to unmapped profiles if enabled and speaker not already mapped
			if (this.autoMappingEnabled && !this.mappedSpeakerIds.has(id)) {
				this.tryAutoMapSpeaker(id);
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
				// We wait for either:
				// 1. A transcribed event (final recognition result) to be received
				// 2. Or a maximum timeout (audio duration + processing buffer)
				const maxWaitTime = Math.max(5000, audioDurationMs + 3000);
				console.log(
					`Waiting up to ${maxWaitTime}ms for Azure to process profile "${profile.profileName}"...`
				);

				// Wait for final transcription or timeout
				await this.waitForEnrollmentTranscription(maxWaitTime);

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
					// Add to unmapped profiles for auto-mapping later
					this.unmappedProfiles.push(profile);
					console.log(`Profile "${profile.profileName}" added to auto-mapping queue`);
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

		// Enable auto-mapping if there are unmapped profiles
		if (this.unmappedProfiles.length > 0) {
			this.autoMappingEnabled = true;
			console.log(
				`Auto-mapping enabled for ${this.unmappedProfiles.length} unmapped profile(s): ${this.unmappedProfiles.map((p) => p.profileName).join(', ')}`
			);
		}

		// Emit enrollment complete event
		this.eventEmitter.emit('enrollmentComplete', {
			enrolled: this.pendingProfiles.length,
			mapped: totalMapped,
			unmappedProfiles: this.unmappedProfiles.map((p) => p.profileName),
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
	 * Try to auto-map a detected speaker to an unmapped profile
	 * Called when a new speaker is detected after enrollment
	 */
	private tryAutoMapSpeaker(speakerId: string): void {
		if (this.unmappedProfiles.length === 0) {
			console.log(`No unmapped profiles available for speaker ${speakerId}`);
			return;
		}

		// Get the first unmapped profile (FIFO order)
		const profile = this.unmappedProfiles.shift();
		if (!profile) {
			return;
		}

		// Map the speaker to this profile
		this.mapSpeaker(speakerId, profile.profileId, profile.profileName);
		this.mappedSpeakerIds.add(speakerId);

		console.log(`[Auto-Map] Mapped speaker ${speakerId} to profile "${profile.profileName}"`);

		// Emit speaker mapped event
		this.eventEmitter.emit('speakerMapped', {
			speakerId,
			profileId: profile.profileId,
			profileName: profile.profileName,
			autoMapped: true,
		});

		// Disable auto-mapping if no more unmapped profiles
		if (this.unmappedProfiles.length === 0) {
			this.autoMappingEnabled = false;
			console.log('[Auto-Map] All profiles have been mapped, auto-mapping disabled');
		}
	}

	/**
	 * Helper to sleep for a given duration
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Wait for enrollment transcription result or timeout
	 * Resolves when a 'transcribed' event is received or timeout expires
	 */
	private waitForEnrollmentTranscription(maxWaitMs: number): Promise<void> {
		return new Promise<void>((resolve) => {
			let resolved = false;

			// Handler for transcribed event
			const onTranscribed = () => {
				if (!resolved) {
					resolved = true;
					this.eventEmitter.off('transcribed', onTranscribed);
					console.log('Enrollment transcription received, proceeding with speaker mapping');
					// Add a small delay to ensure speaker detection has completed
					setTimeout(resolve, 500);
				}
			};

			// Register handler
			this.eventEmitter.on('transcribed', onTranscribed);

			// Timeout fallback
			setTimeout(() => {
				if (!resolved) {
					resolved = true;
					this.eventEmitter.off('transcribed', onTranscribed);
					console.log('Enrollment wait timeout, proceeding with speaker mapping');
					resolve();
				}
			}, maxWaitMs);
		});
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
		this.unmappedProfiles = [];
		this.unmappedSpeakers = [];
		this.mappedSpeakerIds.clear();
		this.currentEnrollmentProfile = null;
		this.currentEnrollmentSpeakers.clear();
		this.autoMappingEnabled = false;
		this.eventEmitter.removeAllListeners();
	}
}
