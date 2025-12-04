/**
 * Speech Service - Manages Azure Speech Service connections and sessions
 *
 * Provides:
 * - Session lifecycle management (create, get, delete)
 * - Voice profile registration with Azure
 * - Mock mode for development without Azure credentials
 */

import type {
	CreateSessionInput,
	DiarizationSession,
	SessionId,
	SpeakerMapping,
} from '@speaker-diarization/core';
import { isMockMode } from './mockSpeechService.js';

// In-memory session storage (would be replaced with proper storage in production)
const sessions = new Map<SessionId, DiarizationSession>();

/**
 * Generate a UUID v4
 */
function generateId(): string {
	return crypto.randomUUID();
}

/**
 * Create a new diarization session
 */
async function createSession(_input: CreateSessionInput): Promise<DiarizationSession> {
	const sessionId = generateId();
	const now = new Date().toISOString();

	const session: DiarizationSession = {
		id: sessionId,
		status: 'initializing',
		speakerMappings: [],
		utterances: [],
		createdAt: now,
		updatedAt: now,
	};

	sessions.set(sessionId, session);

	// In mock mode, we don't need to connect to Azure
	if (!isMockMode()) {
		// TODO: Initialize Azure Speech Service connection
		// This would create a ConversationTranscriber instance
        console.log('Initialize Azure Speech Service connection for session:', sessionId);
	}

	return session;
}

/**
 * Get session by ID
 */
async function getSession(sessionId: SessionId): Promise<DiarizationSession | null> {
	return sessions.get(sessionId) ?? null;
}

/**
 * Delete/end a session
 */
async function deleteSession(sessionId: SessionId): Promise<DiarizationSession | null> {
	const session = sessions.get(sessionId);
	if (!session) {
		return null;
	}

	// Update session status
	session.status = 'completed';
	session.endedAt = new Date().toISOString();
	session.updatedAt = session.endedAt;

	// In production, we would also close Azure connections here
	if (!isMockMode()) {
		// TODO: Close Azure Speech Service connection
	}

	// Remove from active sessions
	sessions.delete(sessionId);

	return session;
}

/**
 * Register a voice profile with the session
 */
async function registerProfile(
	sessionId: SessionId,
	profileId: string,
	profileName: string,
	_audioBase64: string
): Promise<SpeakerMapping> {
	const session = sessions.get(sessionId);
	if (!session) {
		throw new Error('Session not found');
	}

	const registeredAt = new Date().toISOString();

	// Note: We don't assign azureSpeakerId here.
	// Azure ConversationTranscriber will assign speaker IDs (Guest-1, Guest-2, etc.)
	// dynamically during transcription. Users will need to manually map these
	// detected speakers to their registered profiles.
	const mapping: SpeakerMapping = {
		sessionId,
		voiceProfileId: profileId,
		displayName: profileName,
		azureSpeakerId: null, // Will be assigned when user maps a detected speaker
		status: 'pending', // Waiting for speaker detection and manual mapping
		registeredAt,
	};

	session.speakerMappings.push(mapping);
	session.updatedAt = new Date().toISOString();

	// Update status if all profiles are registered
	if (session.status === 'initializing' || session.status === 'registering') {
		session.status = 'registering';
	}

	return mapping;
}

/**
 * Clear all sessions (for testing)
 */
function clearSessions(): void {
	sessions.clear();
}

export const speechService = {
	createSession,
	getSession,
	deleteSession,
	registerProfile,
	clearSessions,
};
