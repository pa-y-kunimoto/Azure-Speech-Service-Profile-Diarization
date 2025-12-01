/**
 * Core library for Azure Speech Service Profile-Based Speaker Diarization
 */

export const VERSION = '0.1.0';

// Type exports
export type {
	// Voice Profile
	VoiceProfile,
	VoiceProfileId,
	AudioBase64,
	VoiceProfileSource,
	CreateVoiceProfileInput,
	VoiceProfileValidationResult,
	VoiceProfileValidationError,
} from './types/voiceProfile.js';

export { VOICE_PROFILE_CONSTANTS } from './types/voiceProfile.js';

export type {
	// Diarization Session
	DiarizationSession,
	SessionId,
	SessionStatus,
	CreateSessionInput,
	SessionStatusUpdate,
	SessionSummary,
} from './types/diarizationSession.js';

export type {
	// Speaker Mapping
	SpeakerMapping,
	AzureSpeakerId,
	RegistrationStatus,
	CreateSpeakerMappingInput,
	SpeakerMappingRegistrationResult,
	SpeakerLookup,
} from './types/speakerMapping.js';

export type {
	// Utterance
	Utterance,
	UtteranceId,
	RecognitionResultInput,
	UtteranceUpdate,
	UtteranceFilter,
	SpeakerUtteranceGroup,
} from './types/utterance.js';

// Utility exports
export {
	validateVoiceProfile,
	validateName,
	validateDuration,
	validateAudioData,
} from './utils/validation.js';
