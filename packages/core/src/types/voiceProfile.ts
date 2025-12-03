/**
 * Voice Profile entity for speaker diarization
 * @see data-model.md - VoiceProfile
 */

/**
 * Unique identifier for a voice profile
 * Format: UUID v4 string
 */
export type VoiceProfileId = string;

/**
 * Base64-encoded audio data
 */
export type AudioBase64 = string;

/**
 * Creation source for voice profile
 */
export type VoiceProfileSource = 'upload' | 'recording';

/**
 * Voice profile entity representing a speaker's audio sample
 * Stored in browser sessionStorage
 */
export interface VoiceProfile {
	/**
	 * Unique identifier (UUID v4)
	 */
	readonly id: VoiceProfileId;

	/**
	 * Display name for the speaker
	 * @minLength 1
	 * @maxLength 50
	 */
	name: string;

	/**
	 * Base64-encoded audio data
	 * Format: WAV 16kHz/16-bit/Mono
	 */
	audioBase64: AudioBase64;

	/**
	 * Audio duration in seconds
	 * @minimum 5 - Azure Speech Service requires at least 5 seconds
	 */
	durationSeconds: number;

	/**
	 * How the profile was created
	 */
	source: VoiceProfileSource;

	/**
	 * ISO 8601 timestamp when profile was created
	 */
	readonly createdAt: string;
}

/**
 * Input for creating a new voice profile
 */
export interface CreateVoiceProfileInput {
	name: string;
	audioBase64: AudioBase64;
	durationSeconds: number;
	source: VoiceProfileSource;
}

/**
 * Validation result for voice profile
 */
export interface VoiceProfileValidationResult {
	valid: boolean;
	errors: VoiceProfileValidationError[];
}

/**
 * Validation error types
 */
export type VoiceProfileValidationError =
	| { code: 'NAME_TOO_SHORT'; message: string }
	| { code: 'NAME_TOO_LONG'; message: string }
	| { code: 'DURATION_TOO_SHORT'; message: string }
	| { code: 'AUDIO_EMPTY'; message: string };

/**
 * Constants for voice profile validation
 */
export const VOICE_PROFILE_CONSTANTS = {
	NAME_MIN_LENGTH: 1,
	NAME_MAX_LENGTH: 50,
	MIN_DURATION_SECONDS: 5,
} as const;
