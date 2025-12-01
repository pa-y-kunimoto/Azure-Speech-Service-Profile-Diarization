/**
 * Validation utilities for VoiceProfile
 * @see data-model.md - VoiceProfile
 */

import type {
	CreateVoiceProfileInput,
	VoiceProfileValidationError,
	VoiceProfileValidationResult,
} from '../types/voiceProfile.js';
import { VOICE_PROFILE_CONSTANTS } from '../types/voiceProfile.js';

/**
 * Validate the profile name
 */
export function validateName(name: string): VoiceProfileValidationResult {
	const errors: VoiceProfileValidationError[] = [];

	if (name.length < VOICE_PROFILE_CONSTANTS.NAME_MIN_LENGTH) {
		errors.push({
			code: 'NAME_TOO_SHORT',
			message: `Name must be at least ${VOICE_PROFILE_CONSTANTS.NAME_MIN_LENGTH} character`,
		});
	}

	if (name.length > VOICE_PROFILE_CONSTANTS.NAME_MAX_LENGTH) {
		errors.push({
			code: 'NAME_TOO_LONG',
			message: `Name must be at most ${VOICE_PROFILE_CONSTANTS.NAME_MAX_LENGTH} characters`,
		});
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Validate the audio duration
 */
export function validateDuration(durationSeconds: number): VoiceProfileValidationResult {
	const errors: VoiceProfileValidationError[] = [];

	if (durationSeconds < VOICE_PROFILE_CONSTANTS.MIN_DURATION_SECONDS) {
		errors.push({
			code: 'DURATION_TOO_SHORT',
			message: `Audio duration must be at least ${VOICE_PROFILE_CONSTANTS.MIN_DURATION_SECONDS} seconds (Azure Speech Service requirement)`,
		});
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Validate the audio data
 */
export function validateAudioData(audioBase64: string): VoiceProfileValidationResult {
	const errors: VoiceProfileValidationError[] = [];

	if (!audioBase64 || audioBase64.trim().length === 0) {
		errors.push({
			code: 'AUDIO_EMPTY',
			message: 'Audio data is required',
		});
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Validate a complete VoiceProfile input
 */
export function validateVoiceProfile(input: CreateVoiceProfileInput): VoiceProfileValidationResult {
	const errors: VoiceProfileValidationError[] = [];

	const nameResult = validateName(input.name);
	errors.push(...nameResult.errors);

	const durationResult = validateDuration(input.durationSeconds);
	errors.push(...durationResult.errors);

	const audioResult = validateAudioData(input.audioBase64);
	errors.push(...audioResult.errors);

	return {
		valid: errors.length === 0,
		errors,
	};
}
