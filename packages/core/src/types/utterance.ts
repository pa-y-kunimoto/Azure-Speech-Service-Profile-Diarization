/**
 * Utterance entity for storing recognized speech segments
 * @see data-model.md - Utterance
 */

import type { SessionId } from './diarizationSession.js';
import type { AzureSpeakerId } from './speakerMapping.js';

/**
 * Unique identifier for an utterance
 * Format: UUID v4 string
 */
export type UtteranceId = string;

/**
 * A recognized speech segment with speaker identification
 */
export interface Utterance {
	/**
	 * Unique utterance identifier (UUID v4)
	 */
	readonly id: UtteranceId;

	/**
	 * Session this utterance belongs to
	 */
	sessionId: SessionId;

	/**
	 * Azure-assigned speaker ID for this utterance
	 */
	azureSpeakerId: AzureSpeakerId;

	/**
	 * Resolved display name (from SpeakerMapping)
	 * May be "Unknown Speaker" if not matched
	 */
	speakerName: string;

	/**
	 * Recognized text content
	 */
	text: string;

	/**
	 * Start offset in seconds from session start
	 */
	startOffsetSeconds: number;

	/**
	 * End offset in seconds from session start
	 */
	endOffsetSeconds: number;

	/**
	 * Duration of the utterance in seconds
	 */
	durationSeconds: number;

	/**
	 * Recognition confidence score (0.0 - 1.0)
	 */
	confidence: number;

	/**
	 * ISO 8601 timestamp when utterance was recognized
	 */
	readonly recognizedAt: string;
}

/**
 * Input from Azure Speech Service recognition result
 */
export interface RecognitionResultInput {
	sessionId: SessionId;
	azureSpeakerId: AzureSpeakerId;
	text: string;
	startOffsetSeconds: number;
	endOffsetSeconds: number;
	confidence: number;
}

/**
 * Real-time utterance update sent via WebSocket
 */
export interface UtteranceUpdate {
	type: 'utterance';
	data: Utterance;
}

/**
 * Utterance filter for querying
 */
export interface UtteranceFilter {
	sessionId?: SessionId;
	speakerId?: AzureSpeakerId;
	speakerName?: string;
	minConfidence?: number;
	startAfter?: number;
	endBefore?: number;
}

/**
 * Grouped utterances by speaker for timeline display
 */
export interface SpeakerUtteranceGroup {
	speakerName: string;
	azureSpeakerId: AzureSpeakerId;
	utterances: Utterance[];
	totalDurationSeconds: number;
	utteranceCount: number;
}
