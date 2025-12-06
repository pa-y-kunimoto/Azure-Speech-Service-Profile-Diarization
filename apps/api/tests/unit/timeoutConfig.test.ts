/**
 * Timeout Config Parser Unit Tests
 *
 * Tests for environment variable parsing and validation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_SESSION_TIMEOUT_MINUTES,
	DEFAULT_SILENCE_TIMEOUT_MINUTES,
	MAX_TIMEOUT_MINUTES,
	MIN_TIMEOUT_MINUTES,
	WARNING_BEFORE_SECONDS,
	loadTimeoutConfig,
	parseTimeoutMinutes,
} from '../../src/utils/timeoutConfig.js';

describe('parseTimeoutMinutes', () => {
	describe('default value handling', () => {
		it('should return default value when value is undefined', () => {
			const result = parseTimeoutMinutes(undefined, 15);
			expect(result).toBe(15);
		});

		it('should return default value when value is empty string', () => {
			const result = parseTimeoutMinutes('', 15);
			expect(result).toBe(15);
		});
	});

	describe('valid values', () => {
		it('should parse valid integer string', () => {
			const result = parseTimeoutMinutes('30', 15);
			expect(result).toBe(30);
		});

		it('should return null for 0 (unlimited/disabled)', () => {
			const result = parseTimeoutMinutes('0', 15);
			expect(result).toBeNull();
		});

		it('should accept minimum value (1)', () => {
			const result = parseTimeoutMinutes('1', 15);
			expect(result).toBe(1);
		});

		it('should accept maximum value (120)', () => {
			const result = parseTimeoutMinutes('120', 15);
			expect(result).toBe(120);
		});
	});

	describe('boundary values', () => {
		it('should clamp value below minimum to minimum', () => {
			const result = parseTimeoutMinutes('-5', 15);
			expect(result).toBe(MIN_TIMEOUT_MINUTES);
		});

		it('should clamp value above maximum to maximum', () => {
			const result = parseTimeoutMinutes('200', 15);
			expect(result).toBe(MAX_TIMEOUT_MINUTES);
		});
	});

	describe('invalid values', () => {
		it('should return default for non-numeric string', () => {
			const result = parseTimeoutMinutes('abc', 15);
			expect(result).toBe(15);
		});

		it('should return default for floating point string', () => {
			// parseInt will parse "10.5" as 10
			const result = parseTimeoutMinutes('10.5', 15);
			expect(result).toBe(10);
		});
	});
});

describe('loadTimeoutConfig', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.resetModules();
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it('should load default values when no env vars set', () => {
		process.env.SESSION_TIMEOUT_MINUTES = undefined;
		process.env.SILENCE_TIMEOUT_MINUTES = undefined;

		const config = loadTimeoutConfig();

		expect(config.sessionTimeoutMinutes).toBe(DEFAULT_SESSION_TIMEOUT_MINUTES);
		expect(config.silenceTimeoutMinutes).toBe(DEFAULT_SILENCE_TIMEOUT_MINUTES);
		expect(config.warningBeforeSeconds).toBe(WARNING_BEFORE_SECONDS);
	});

	it('should load custom session timeout from env', () => {
		process.env.SESSION_TIMEOUT_MINUTES = '30';
		process.env.SILENCE_TIMEOUT_MINUTES = undefined;

		const config = loadTimeoutConfig();

		expect(config.sessionTimeoutMinutes).toBe(30);
		expect(config.silenceTimeoutMinutes).toBe(DEFAULT_SILENCE_TIMEOUT_MINUTES);
	});

	it('should load custom silence timeout from env', () => {
		process.env.SESSION_TIMEOUT_MINUTES = undefined;
		process.env.SILENCE_TIMEOUT_MINUTES = '10';

		const config = loadTimeoutConfig();

		expect(config.sessionTimeoutMinutes).toBe(DEFAULT_SESSION_TIMEOUT_MINUTES);
		expect(config.silenceTimeoutMinutes).toBe(10);
	});

	it('should return null for 0 values (disabled)', () => {
		process.env.SESSION_TIMEOUT_MINUTES = '0';
		process.env.SILENCE_TIMEOUT_MINUTES = '0';

		const config = loadTimeoutConfig();

		expect(config.sessionTimeoutMinutes).toBeNull();
		expect(config.silenceTimeoutMinutes).toBeNull();
	});

	it('should always have fixed warning seconds', () => {
		const config = loadTimeoutConfig();

		expect(config.warningBeforeSeconds).toBe(60);
	});
});

describe('constants', () => {
	it('should have correct default values', () => {
		expect(DEFAULT_SESSION_TIMEOUT_MINUTES).toBe(15);
		expect(DEFAULT_SILENCE_TIMEOUT_MINUTES).toBe(5);
		expect(WARNING_BEFORE_SECONDS).toBe(60);
		expect(MIN_TIMEOUT_MINUTES).toBe(1);
		expect(MAX_TIMEOUT_MINUTES).toBe(120);
	});
});
