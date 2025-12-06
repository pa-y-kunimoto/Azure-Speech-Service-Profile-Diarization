/**
 * DiarizationClient - Azure Speech Service wrapper for speaker diarization
 *
 * Provides:
 * - Real-time transcription with automatic speaker identification
 * - Speaker mapping management (Azure assigns Guest-1, Guest-2, etc.)
 * - Local voice profile storage for reference
 *
 * Note: Azure Speech SDK for JavaScript does not include VoiceProfileClient.
 * Speaker identification is handled automatically by ConversationTranscriber,
 * which assigns speaker IDs like "Guest-1", "Guest-2", etc.
 * Users can then map these IDs to meaningful names.
 */

import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

export interface DiarizationClientConfig {
	subscriptionKey: string;
	region?: string;
	endpoint?: string;
	language?: string;
}

export interface AudioFormat {
	sampleRate: number;
	bitsPerSample: number;
	channels: number;
}

export interface EnrollmentResult {
	profileId: string;
	speakerId: string;
}

export interface LocalVoiceProfile {
	profileId: string;
	displayName: string;
	audioData?: ArrayBuffer;
	createdAt: string;
}

interface SpeakerInfo {
	profileId: string;
	displayName: string;
}

type EventCallback = (...args: unknown[]) => void;

/**
 * Azure Speech Service client for speaker diarization
 *
 * Uses ConversationTranscriber for automatic speaker identification.
 * Azure will assign speaker IDs (Guest-1, Guest-2, etc.) automatically.
 * Use setSpeakerMapping() to associate these IDs with meaningful names.
 */
export class DiarizationClient {
	private speechConfig: SpeechSDK.SpeechConfig;
	private transcriber: SpeechSDK.ConversationTranscriber | null = null;
	private pushStream: SpeechSDK.PushAudioInputStream | null = null;
	private enrolledProfiles: Map<string, LocalVoiceProfile> = new Map();
	private speakerMappings: Map<string, SpeakerInfo> = new Map(); // azureSpeakerId -> info
	private eventListeners: Map<string, EventCallback[]> = new Map();
	private _isTranscribing = false;
	private profileCounter = 0;

	constructor(config: DiarizationClientConfig) {
		if (!config.subscriptionKey) {
			throw new Error('Subscription key is required');
		}

		if (!config.region && !config.endpoint) {
			throw new Error('Either region or endpoint must be provided');
		}

		if (config.endpoint) {
			this.speechConfig = SpeechSDK.SpeechConfig.fromEndpoint(
				new URL(config.endpoint),
				config.subscriptionKey
			);
		} else {
			this.speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
				config.subscriptionKey,
				config.region || 'eastus'
			);
		}

		this.speechConfig.speechRecognitionLanguage = config.language ?? 'ja-JP';
	}

	/**
	 * Check if currently transcribing
	 */
	get isTranscribing(): boolean {
		return this._isTranscribing;
	}

	/**
	 * Enroll a voice profile locally and return a placeholder speaker ID
	 *
	 * Note: Azure Speech SDK for JavaScript does not support VoiceProfileClient.
	 * This method stores the profile locally. When transcription starts,
	 * Azure will automatically detect speakers and assign IDs like Guest-1.
	 * Use setSpeakerMapping() to associate detected speaker IDs with profiles.
	 */
	async enrollVoiceProfile(profileId: string, audioData: Buffer): Promise<EnrollmentResult> {
		// Store profile locally for reference
		// Convert to ArrayBuffer to avoid SharedArrayBuffer type issues
		const audioBuffer = new ArrayBuffer(audioData.byteLength);
		new Uint8Array(audioBuffer).set(audioData);

		const profile: LocalVoiceProfile = {
			profileId,
			displayName: profileId,
			audioData: audioBuffer,
			createdAt: new Date().toISOString(),
		};

		this.enrolledProfiles.set(profileId, profile);

		// Generate a placeholder speaker ID
		// This will be updated when actual transcription occurs
		this.profileCounter++;
		const speakerId = `Guest-${this.profileCounter}`;

		return {
			profileId,
			speakerId,
		};
	}

	/**
	 * Start real-time transcription
	 */
	async startTranscription(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				// Create push stream for audio input
				const format = SpeechSDK.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
				this.pushStream = SpeechSDK.AudioInputStream.createPushStream(format);
				const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(this.pushStream);

				// Create conversation transcriber
				this.transcriber = new SpeechSDK.ConversationTranscriber(this.speechConfig, audioConfig);

				// Set up event handlers
				this.transcriber.transcribing = (_, e) => {
					console.log('[DiarizationClient] transcribing event:', {
						text: e.result?.text,
						speakerId: e.result?.speakerId,
						reason: e.result?.reason,
					});
					// Emit speakerDetected for interim results too (important for enrollment)
					const speakerId = e.result?.speakerId;
					if (speakerId && !this.speakerMappings.has(speakerId)) {
						this.emit('speakerDetected', speakerId);
					}
					this.emit('transcribing', e);
				};

				this.transcriber.transcribed = (_, e) => {
					console.log('[DiarizationClient] transcribed event:', {
						text: e.result?.text,
						speakerId: e.result?.speakerId,
						reason: e.result?.reason,
					});
					// Auto-detect new speakers and emit event
					const speakerId = e.result?.speakerId;
					if (speakerId && !this.speakerMappings.has(speakerId)) {
						this.emit('speakerDetected', speakerId);
					}
					this.emit('transcribed', e);
				};

				this.transcriber.canceled = (_, e) => {
					console.log('[DiarizationClient] canceled event:', {
						reason: e.reason,
						errorDetails: e.errorDetails,
					});
					this.emit('canceled', e);
				};

				this.transcriber.sessionStarted = (_, e) => {
					this.emit('sessionStarted', e);
				};

				this.transcriber.sessionStopped = (_, e) => {
					this.emit('sessionStopped', e);
				};

				// Start transcribing
				this.transcriber.startTranscribingAsync(
					() => {
						this._isTranscribing = true;
						resolve();
					},
					(error) => reject(new Error(`Failed to start transcription: ${error}`))
				);
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Stop transcription
	 */
	async stopTranscription(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.transcriber) {
				this._isTranscribing = false;
				resolve();
				return;
			}

			this.transcriber.stopTranscribingAsync(
				() => {
					this._isTranscribing = false;
					if (this.pushStream) {
						this.pushStream.close();
						this.pushStream = null;
					}
					resolve();
				},
				(error) => reject(new Error(`Failed to stop transcription: ${error}`))
			);
		});
	}

	/**
	 * Push audio chunk for processing
	 */
	pushAudioChunk(chunk: Uint8Array): void {
		if (this.pushStream) {
			const buffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
			this.pushStream.write(toArrayBuffer(new Uint8Array(buffer)));
		}
	}

	/**
	 * Validate audio format
	 */
	validateAudioFormat(format: AudioFormat): boolean {
		// Azure Speech Service requires 16kHz, 16-bit, mono
		return format.sampleRate === 16000 && format.bitsPerSample === 16 && format.channels === 1;
	}

	/**
	 * Get enrolled profiles
	 */
	getEnrolledProfiles(): string[] {
		return Array.from(this.enrolledProfiles.keys());
	}

	/**
	 * Get local voice profile by ID
	 */
	getProfile(profileId: string): LocalVoiceProfile | undefined {
		return this.enrolledProfiles.get(profileId);
	}

	/**
	 * Set speaker mapping - associate Azure speaker ID with a profile
	 *
	 * Call this when a new speaker is detected (Guest-1, Guest-2, etc.)
	 * to map them to a registered profile or display name.
	 */
	setSpeakerMapping(azureSpeakerId: string, profileId: string, displayName: string): void {
		this.speakerMappings.set(azureSpeakerId, { profileId, displayName });
	}

	/**
	 * Get speaker name from Azure speaker ID
	 */
	getSpeakerName(azureSpeakerId: string): string {
		const info = this.speakerMappings.get(azureSpeakerId);
		return info?.displayName ?? 'Unknown Speaker';
	}

	/**
	 * Get all speaker mappings
	 */
	getAllSpeakerMappings(): Map<string, SpeakerInfo> {
		return new Map(this.speakerMappings);
	}

	/**
	 * Register event listener
	 *
	 * Events:
	 * - 'transcribing': Interim transcription result
	 * - 'transcribed': Final transcription result
	 * - 'speakerDetected': New speaker detected (Guest-1, etc.)
	 * - 'canceled': Transcription canceled
	 * - 'sessionStarted': Session started
	 * - 'sessionStopped': Session stopped
	 */
	on(event: string, callback: EventCallback): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, []);
		}
		this.eventListeners.get(event)?.push(callback);
	}

	/**
	 * Remove event listener
	 */
	off(event: string, callback: EventCallback): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			const index = listeners.indexOf(callback);
			if (index !== -1) {
				listeners.splice(index, 1);
			}
		}
	}

	/**
	 * Emit event
	 */
	private emit(event: string, ...args: unknown[]): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			for (const callback of listeners) {
				callback(...args);
			}
		}
	}

	/**
	 * Check if there are event listeners
	 */
	hasListeners(): boolean {
		return this.eventListeners.size > 0;
	}

	/**
	 * Dispose and cleanup resources
	 */
	async dispose(): Promise<void> {
		if (this._isTranscribing) {
			await this.stopTranscription();
		}

		if (this.pushStream) {
			this.pushStream.close();
			this.pushStream = null;
		}

		this.transcriber = null;
		this.enrolledProfiles.clear();
		this.speakerMappings.clear();
		this.eventListeners.clear();
	}
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
	const buffer = new ArrayBuffer(u8.byteLength);
	new Uint8Array(buffer).set(u8);
	return buffer;
}
