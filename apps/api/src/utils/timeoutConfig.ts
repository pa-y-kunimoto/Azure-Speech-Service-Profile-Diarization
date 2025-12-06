/**
 * Timeout Configuration Parser
 *
 * Parses and validates timeout configuration from environment variables.
 */

/**
 * Default timeout values in minutes
 */
export const DEFAULT_SESSION_TIMEOUT_MINUTES = 15;
export const DEFAULT_SILENCE_TIMEOUT_MINUTES = 5;
export const WARNING_BEFORE_SECONDS = 60;
export const MIN_TIMEOUT_MINUTES = 1;
export const MAX_TIMEOUT_MINUTES = 120;

/**
 * Parse timeout minutes from environment variable string.
 *
 * @param value - The environment variable value (string or undefined)
 * @param defaultValue - Default value if not specified
 * @returns number (minutes) or null (unlimited/disabled)
 */
export function parseTimeoutMinutes(
	value: string | undefined,
	defaultValue: number
): number | null {
	if (value === undefined || value === '') {
		return defaultValue;
	}

	const parsed = Number.parseInt(value, 10);

	if (Number.isNaN(parsed)) {
		console.warn(`Invalid timeout value "${value}", using default: ${defaultValue}`);
		return defaultValue;
	}

	// 0 means unlimited/disabled
	if (parsed === 0) {
		return null;
	}

	// Clamp to valid range
	if (parsed < MIN_TIMEOUT_MINUTES) {
		console.warn(`Timeout value ${parsed} below minimum (${MIN_TIMEOUT_MINUTES}), using minimum`);
		return MIN_TIMEOUT_MINUTES;
	}

	if (parsed > MAX_TIMEOUT_MINUTES) {
		console.warn(`Timeout value ${parsed} above maximum (${MAX_TIMEOUT_MINUTES}), using maximum`);
		return MAX_TIMEOUT_MINUTES;
	}

	return parsed;
}

/**
 * Timeout configuration loaded from environment
 */
export interface TimeoutConfig {
	/** Session timeout in minutes, null = unlimited */
	sessionTimeoutMinutes: number | null;
	/** Silence timeout in minutes, null = disabled */
	silenceTimeoutMinutes: number | null;
	/** Warning before timeout in seconds (fixed at 60) */
	warningBeforeSeconds: number;
	/** Whether session extension is allowed */
	allowSessionExtend: boolean;
}

/**
 * Load timeout configuration from environment variables.
 *
 * @returns TimeoutConfig with validated values
 */
/**
 * Parse boolean from environment variable string.
 *
 * @param value - The environment variable value
 * @param defaultValue - Default value if not specified
 * @returns boolean
 */
export function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
	if (value === undefined || value === '') {
		return defaultValue;
	}
	const lowered = value.toLowerCase();
	return lowered === 'true' || lowered === '1' || lowered === 'yes';
}

export function loadTimeoutConfig(): TimeoutConfig {
	const config = {
		sessionTimeoutMinutes: parseTimeoutMinutes(
			process.env.SESSION_TIMEOUT_MINUTES,
			DEFAULT_SESSION_TIMEOUT_MINUTES
		),
		silenceTimeoutMinutes: parseTimeoutMinutes(
			process.env.SILENCE_TIMEOUT_MINUTES,
			DEFAULT_SILENCE_TIMEOUT_MINUTES
		),
		warningBeforeSeconds: WARNING_BEFORE_SECONDS,
		allowSessionExtend: parseBooleanEnv(process.env.ALLOW_SESSION_EXTEND, false),
	};

	console.log('[Timeout Config] Loaded configuration:', {
		SESSION_TIMEOUT_MINUTES: process.env.SESSION_TIMEOUT_MINUTES ?? '(not set)',
		SILENCE_TIMEOUT_MINUTES: process.env.SILENCE_TIMEOUT_MINUTES ?? '(not set)',
		ALLOW_SESSION_EXTEND: process.env.ALLOW_SESSION_EXTEND ?? '(not set)',
		resolved: config,
	});

	return config;
}
