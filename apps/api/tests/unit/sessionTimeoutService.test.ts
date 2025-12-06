/**
 * SessionTimeoutService Unit Tests
 *
 * Tests for session timeout management functionality.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	type SessionTimeoutConfig,
	SessionTimeoutService,
} from '../../src/services/sessionTimeoutService.js';

describe('SessionTimeoutService', () => {
	let service: SessionTimeoutService;

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		service?.stop();
		vi.useRealTimers();
	});

	describe('constructor', () => {
		it('should create service with default config', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: 15,
				silenceTimeoutMinutes: 5,
				warningBeforeSeconds: 60,
			};
			service = new SessionTimeoutService('test-session', config);
			expect(service).toBeDefined();
		});

		it('should create service with unlimited session timeout', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: null,
				silenceTimeoutMinutes: 5,
				warningBeforeSeconds: 60,
			};
			service = new SessionTimeoutService('test-session', config);
			expect(service).toBeDefined();
		});

		it('should create service with disabled silence timeout', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: 15,
				silenceTimeoutMinutes: null,
				warningBeforeSeconds: 60,
			};
			service = new SessionTimeoutService('test-session', config);
			expect(service).toBeDefined();
		});
	});

	describe('start', () => {
		it('should initialize timers on start', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: 15,
				silenceTimeoutMinutes: 5,
				warningBeforeSeconds: 60,
			};
			service = new SessionTimeoutService('test-session', config);
			service.start();

			const state = service.getState();
			expect(state.sessionId).toBe('test-session');
			expect(state.sessionStartedAt).toBeGreaterThan(0);
			expect(state.sessionTimeoutAt).toBeGreaterThan(state.sessionStartedAt);
			expect(state.silenceTimeoutAt).toBeGreaterThan(state.sessionStartedAt);
		});

		it('should have null sessionTimeoutAt when unlimited', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: null,
				silenceTimeoutMinutes: 5,
				warningBeforeSeconds: 60,
			};
			service = new SessionTimeoutService('test-session', config);
			service.start();

			const state = service.getState();
			expect(state.sessionTimeoutAt).toBeNull();
		});

		it('should have null silenceTimeoutAt when disabled', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: 15,
				silenceTimeoutMinutes: null,
				warningBeforeSeconds: 60,
			};
			service = new SessionTimeoutService('test-session', config);
			service.start();

			const state = service.getState();
			expect(state.silenceTimeoutAt).toBeNull();
		});
	});

	describe('getTimeoutStatus', () => {
		it('should return remaining seconds correctly', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: 1, // 1 minute for easier testing
				silenceTimeoutMinutes: 1,
				warningBeforeSeconds: 30,
			};
			service = new SessionTimeoutService('test-session', config);
			service.start();

			const status = service.getTimeoutStatus();
			expect(status.sessionTimeoutRemaining).toBeCloseTo(60, 0);
			expect(status.silenceTimeoutRemaining).toBeCloseTo(60, 0);
		});

		it('should return null for disabled timeouts', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: null,
				silenceTimeoutMinutes: null,
				warningBeforeSeconds: 60,
			};
			service = new SessionTimeoutService('test-session', config);
			service.start();

			const status = service.getTimeoutStatus();
			expect(status.sessionTimeoutRemaining).toBeNull();
			expect(status.silenceTimeoutRemaining).toBeNull();
		});
	});

	describe('session timeout warning', () => {
		it('should emit warning 60 seconds before timeout', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: 2, // 2 minutes
				silenceTimeoutMinutes: null,
				warningBeforeSeconds: 60,
			};
			service = new SessionTimeoutService('test-session', config);

			const warningHandler = vi.fn();
			service.on('sessionWarning', warningHandler);

			service.start();

			// Advance to 1 minute before timeout (60 seconds in)
			vi.advanceTimersByTime(60 * 1000);

			expect(warningHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					warningType: 'session',
					remainingSeconds: 60,
				})
			);
		});

		it('should not emit warning multiple times', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: 2,
				silenceTimeoutMinutes: null,
				warningBeforeSeconds: 60,
			};
			service = new SessionTimeoutService('test-session', config);

			const warningHandler = vi.fn();
			service.on('sessionWarning', warningHandler);

			service.start();

			// Advance past warning time
			vi.advanceTimersByTime(65 * 1000);

			expect(warningHandler).toHaveBeenCalledTimes(1);
		});
	});

	describe('session timeout', () => {
		it('should emit timeout event when session expires', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: 1, // 1 minute
				silenceTimeoutMinutes: null,
				warningBeforeSeconds: 30,
			};
			service = new SessionTimeoutService('test-session', config);

			const timeoutHandler = vi.fn();
			service.on('sessionTimeout', timeoutHandler);

			service.start();

			// Advance to timeout
			vi.advanceTimersByTime(60 * 1000);

			expect(timeoutHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					reason: 'session_timeout',
				})
			);
		});

		it('should not emit timeout when session is unlimited', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: null,
				silenceTimeoutMinutes: null,
				warningBeforeSeconds: 60,
			};
			service = new SessionTimeoutService('test-session', config);

			const timeoutHandler = vi.fn();
			service.on('sessionTimeout', timeoutHandler);

			service.start();

			// Advance a long time
			vi.advanceTimersByTime(60 * 60 * 1000); // 1 hour

			expect(timeoutHandler).not.toHaveBeenCalled();
		});
	});

	describe('extend', () => {
		it('should reset session timeout on extend', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: 2,
				silenceTimeoutMinutes: null,
				warningBeforeSeconds: 60,
			};
			service = new SessionTimeoutService('test-session', config);

			service.start();

			// Get initial timeout
			const initialStatus = service.getTimeoutStatus();
			expect(initialStatus.sessionTimeoutRemaining).toBeCloseTo(120, 0);

			// Advance 30 seconds
			vi.advanceTimersByTime(30 * 1000);

			// Extend session
			const result = service.extend();
			expect(result).toBe(true);

			// Should be back to full timeout
			const newStatus = service.getTimeoutStatus();
			expect(newStatus.sessionTimeoutRemaining).toBeCloseTo(120, 0);
		});

		it('should return false when session timeout is unlimited', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: null,
				silenceTimeoutMinutes: 5,
				warningBeforeSeconds: 60,
			};
			service = new SessionTimeoutService('test-session', config);

			service.start();

			const result = service.extend();
			expect(result).toBe(false);
		});

		it('should reset warning shown flag on extend', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: 2,
				silenceTimeoutMinutes: null,
				warningBeforeSeconds: 60,
			};
			service = new SessionTimeoutService('test-session', config);

			const warningHandler = vi.fn();
			service.on('sessionWarning', warningHandler);

			service.start();

			// Advance to trigger warning
			vi.advanceTimersByTime(60 * 1000);
			expect(warningHandler).toHaveBeenCalledTimes(1);

			// Extend
			service.extend();

			// Advance to trigger warning again
			vi.advanceTimersByTime(60 * 1000);
			expect(warningHandler).toHaveBeenCalledTimes(2);
		});
	});

	describe('silence timeout', () => {
		it('should emit warning before silence timeout', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: null,
				silenceTimeoutMinutes: 2,
				warningBeforeSeconds: 60,
			};
			service = new SessionTimeoutService('test-session', config);

			const warningHandler = vi.fn();
			service.on('silenceWarning', warningHandler);

			service.start();

			// Advance to 1 minute before silence timeout
			vi.advanceTimersByTime(60 * 1000);

			expect(warningHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					warningType: 'silence',
					remainingSeconds: 60,
				})
			);
		});

		it('should emit silence timeout event', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: null,
				silenceTimeoutMinutes: 1,
				warningBeforeSeconds: 30,
			};
			service = new SessionTimeoutService('test-session', config);

			const timeoutHandler = vi.fn();
			service.on('silenceTimeout', timeoutHandler);

			service.start();

			// Advance to silence timeout
			vi.advanceTimersByTime(60 * 1000);

			expect(timeoutHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					reason: 'silence_timeout',
				})
			);
		});
	});

	describe('resetSilenceTimer', () => {
		it('should reset silence timer on speech detection', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: null,
				silenceTimeoutMinutes: 1,
				warningBeforeSeconds: 30,
			};
			service = new SessionTimeoutService('test-session', config);

			service.start();

			// Advance 30 seconds
			vi.advanceTimersByTime(30 * 1000);

			const beforeReset = service.getTimeoutStatus();
			expect(beforeReset.silenceTimeoutRemaining).toBeCloseTo(30, 0);

			// Reset silence timer (speech detected)
			service.resetSilenceTimer();

			const afterReset = service.getTimeoutStatus();
			expect(afterReset.silenceTimeoutRemaining).toBeCloseTo(60, 0);
		});

		it('should reset silence warning flag', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: null,
				silenceTimeoutMinutes: 2,
				warningBeforeSeconds: 60,
			};
			service = new SessionTimeoutService('test-session', config);

			const warningHandler = vi.fn();
			service.on('silenceWarning', warningHandler);

			service.start();

			// Advance to trigger warning
			vi.advanceTimersByTime(60 * 1000);
			expect(warningHandler).toHaveBeenCalledTimes(1);

			// Reset silence timer
			service.resetSilenceTimer();

			// Advance to trigger warning again
			vi.advanceTimersByTime(60 * 1000);
			expect(warningHandler).toHaveBeenCalledTimes(2);
		});

		it('should have no effect when silence timeout is disabled', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: 15,
				silenceTimeoutMinutes: null,
				warningBeforeSeconds: 60,
			};
			service = new SessionTimeoutService('test-session', config);

			service.start();
			service.resetSilenceTimer();

			const status = service.getTimeoutStatus();
			expect(status.silenceTimeoutRemaining).toBeNull();
		});
	});

	describe('tick event', () => {
		it('should emit tick events with current status', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: 1,
				silenceTimeoutMinutes: 1,
				warningBeforeSeconds: 30,
			};
			service = new SessionTimeoutService('test-session', config);

			const tickHandler = vi.fn();
			service.on('tick', tickHandler);

			service.start();

			// Advance 1 second
			vi.advanceTimersByTime(1000);

			expect(tickHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					sessionTimeoutRemaining: expect.any(Number),
					silenceTimeoutRemaining: expect.any(Number),
				})
			);
		});
	});

	describe('stop', () => {
		it('should stop all timers', () => {
			const config: SessionTimeoutConfig = {
				sessionTimeoutMinutes: 1,
				silenceTimeoutMinutes: 1,
				warningBeforeSeconds: 30,
			};
			service = new SessionTimeoutService('test-session', config);

			const timeoutHandler = vi.fn();
			service.on('sessionTimeout', timeoutHandler);

			service.start();
			service.stop();

			// Advance past timeout
			vi.advanceTimersByTime(120 * 1000);

			expect(timeoutHandler).not.toHaveBeenCalled();
		});
	});
});
