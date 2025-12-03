/**
 * Unit tests for VoiceProfile validation
 * TDD: Write tests first, verify FAIL, then implement
 */

import { describe, expect, it } from 'vitest';
import type { CreateVoiceProfileInput } from '../../src/index.js';
import { VOICE_PROFILE_CONSTANTS } from '../../src/index.js';
import {
	validateAudioData,
	validateDuration,
	validateName,
	validateVoiceProfile,
} from '../../src/utils/validation.js';

describe('VoiceProfile Validation', () => {
	describe('validateName', () => {
		it('should pass for valid name within length limits', () => {
			const result = validateName('Test Speaker');
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should fail for empty name', () => {
			const result = validateName('');
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(expect.objectContaining({ code: 'NAME_TOO_SHORT' }));
		});

		it('should fail for name exceeding max length', () => {
			const longName = 'a'.repeat(VOICE_PROFILE_CONSTANTS.NAME_MAX_LENGTH + 1);
			const result = validateName(longName);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(expect.objectContaining({ code: 'NAME_TOO_LONG' }));
		});

		it('should pass for name at exact max length', () => {
			const exactName = 'a'.repeat(VOICE_PROFILE_CONSTANTS.NAME_MAX_LENGTH);
			const result = validateName(exactName);
			expect(result.valid).toBe(true);
		});

		it('should pass for single character name', () => {
			const result = validateName('A');
			expect(result.valid).toBe(true);
		});
	});

	describe('validateDuration', () => {
		it('should pass for duration above minimum', () => {
			const result = validateDuration(10);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should pass for duration at exact minimum', () => {
			const result = validateDuration(VOICE_PROFILE_CONSTANTS.MIN_DURATION_SECONDS);
			expect(result.valid).toBe(true);
		});

		it('should fail for duration below minimum', () => {
			const result = validateDuration(VOICE_PROFILE_CONSTANTS.MIN_DURATION_SECONDS - 1);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(expect.objectContaining({ code: 'DURATION_TOO_SHORT' }));
		});

		it('should fail for zero duration', () => {
			const result = validateDuration(0);
			expect(result.valid).toBe(false);
		});

		it('should fail for negative duration', () => {
			const result = validateDuration(-5);
			expect(result.valid).toBe(false);
		});
	});

	describe('validateAudioData', () => {
		it('should pass for non-empty audio data', () => {
			const result = validateAudioData('base64encodedaudiodata');
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should fail for empty audio data', () => {
			const result = validateAudioData('');
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(expect.objectContaining({ code: 'AUDIO_EMPTY' }));
		});

		it('should fail for whitespace-only audio data', () => {
			const result = validateAudioData('   ');
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(expect.objectContaining({ code: 'AUDIO_EMPTY' }));
		});
	});

	describe('validateVoiceProfile', () => {
		const validInput: CreateVoiceProfileInput = {
			name: 'Test Speaker',
			audioBase64: 'base64encodedaudiodata',
			durationSeconds: 10,
			source: 'upload',
		};

		it('should pass for valid complete input', () => {
			const result = validateVoiceProfile(validInput);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should collect multiple errors when multiple fields are invalid', () => {
			const invalidInput: CreateVoiceProfileInput = {
				name: '',
				audioBase64: '',
				durationSeconds: 2,
				source: 'upload',
			};
			const result = validateVoiceProfile(invalidInput);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThanOrEqual(3);
		});

		it('should handle upload source correctly', () => {
			const result = validateVoiceProfile({ ...validInput, source: 'upload' });
			expect(result.valid).toBe(true);
		});

		it('should handle recording source correctly', () => {
			const result = validateVoiceProfile({ ...validInput, source: 'recording' });
			expect(result.valid).toBe(true);
		});
	});
});
