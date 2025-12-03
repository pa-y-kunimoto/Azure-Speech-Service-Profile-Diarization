/**
 * Diarization Session entity for managing speaker identification sessions
 * @see data-model.md - DiarizationSession
 */

import type { SpeakerMapping } from './speakerMapping.js';
import type { Utterance } from './utterance.js';

/**
 * Unique identifier for a diarization session
 * Format: UUID v4 string
 */
export type SessionId = string;

/**
 * Session lifecycle state
 */
export type SessionStatus =
	| 'initializing' // Session created, profiles being registered
	| 'registering' // Profiles being sent to Azure
	| 'active' // Ready for real-time recognition
	| 'recognizing' // Actively processing audio
	| 'completed' // Session finished
	| 'error'; // An error occurred

/**
 * Diarization session entity
 * Manages the lifecycle of a speaker identification session
 */
export interface DiarizationSession {
	/**
	 * Unique session identifier (UUID v4)
	 */
	readonly id: SessionId;

	/**
	 * Current session status
	 */
	status: SessionStatus;

	/**
	 * Mappings between voice profiles and Azure speaker IDs
	 */
	speakerMappings: SpeakerMapping[];

	/**
	 * Collected utterances during the session
	 */
	utterances: Utterance[];

	/**
	 * ISO 8601 timestamp when session was created
	 */
	readonly createdAt: string;

	/**
	 * ISO 8601 timestamp when session was last updated
	 */
	updatedAt: string;

	/**
	 * ISO 8601 timestamp when session ended (if completed/error)
	 */
	endedAt?: string;

	/**
	 * Error message if status is 'error'
	 */
	errorMessage?: string;
}

/**
 * Input for creating a new diarization session
 */
export interface CreateSessionInput {
	/**
	 * IDs of voice profiles to register with the session
	 */
	profileIds: string[];
}

/**
 * Session state update
 */
export interface SessionStatusUpdate {
	sessionId: SessionId;
	status: SessionStatus;
	errorMessage?: string;
}

/**
 * Session summary for completed sessions
 */
export interface SessionSummary {
	sessionId: SessionId;
	totalUtterances: number;
	speakerCount: number;
	durationSeconds: number;
	createdAt: string;
	endedAt: string;
}
