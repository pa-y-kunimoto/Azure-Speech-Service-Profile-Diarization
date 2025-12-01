/**
 * Speaker Mapping entity for linking voice profiles to Azure speaker IDs
 * @see data-model.md - SpeakerMapping
 */

import type { SessionId } from './diarizationSession.js';
import type { VoiceProfileId } from './voiceProfile.js';

/**
 * Azure Speech Service speaker identifier
 * Generated when a voice profile is registered
 */
export type AzureSpeakerId = string;

/**
 * Profile registration status
 */
export type RegistrationStatus =
	| 'pending' // Not yet sent to Azure
	| 'registering' // Currently being registered
	| 'completed' // Successfully registered
	| 'failed'; // Registration failed

/**
 * Mapping between a voice profile and Azure speaker ID
 */
export interface SpeakerMapping {
	/**
	 * Reference to the voice profile
	 */
	voiceProfileId: VoiceProfileId;

	/**
	 * Display name from the voice profile (denormalized for convenience)
	 */
	displayName: string;

	/**
	 * Azure-assigned speaker ID (null until registration completes)
	 */
	azureSpeakerId: AzureSpeakerId | null;

	/**
	 * Registration status with Azure
	 */
	status: RegistrationStatus;

	/**
	 * Session this mapping belongs to
	 */
	sessionId: SessionId;

	/**
	 * Error message if registration failed
	 */
	errorMessage?: string;

	/**
	 * ISO 8601 timestamp when registration completed
	 */
	registeredAt?: string;
}

/**
 * Input for creating a speaker mapping
 */
export interface CreateSpeakerMappingInput {
	voiceProfileId: VoiceProfileId;
	displayName: string;
	sessionId: SessionId;
}

/**
 * Update for speaker mapping after Azure registration
 */
export interface SpeakerMappingRegistrationResult {
	voiceProfileId: VoiceProfileId;
	azureSpeakerId: AzureSpeakerId;
	registeredAt: string;
}

/**
 * Lookup result for resolving Azure speaker ID to display name
 */
export interface SpeakerLookup {
	azureSpeakerId: AzureSpeakerId;
	displayName: string;
	voiceProfileId: VoiceProfileId;
}
