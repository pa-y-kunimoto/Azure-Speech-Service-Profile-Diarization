/**
 * Silence Timeout Integration Tests
 *
 * Tests for User Story 4: 無音検出による自動セッション終了
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	type SessionTimeoutConfig,
	SessionTimeoutService,
	type TimeoutEndEvent,
	type TimeoutWarning,
} from '../../src/services/sessionTimeoutService';

describe('Silence Timeout Integration', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const createConfig = (
		sessionMinutes: number | null,
		silenceMinutes: number | null
	): SessionTimeoutConfig => ({
		sessionTimeoutMinutes: sessionMinutes,
		silenceTimeoutMinutes: silenceMinutes,
		warningBeforeSeconds: 60,
	});

	describe('silence detection', () => {
		it('should emit warning 1 minute before silence timeout', () => {
			const config = createConfig(15, 5);
			const service = new SessionTimeoutService('test-session', config);

			const onWarning = vi.fn();
			service.on('silenceWarning', onWarning);

			service.start();

			// Advance to 1 minute before silence timeout (4 minutes)
			vi.advanceTimersByTime(4 * 60 * 1000);

			expect(onWarning).toHaveBeenCalledWith(
				expect.objectContaining({
					warningType: 'silence',
				})
			);
		});

		it('should emit silence timeout after configured minutes', () => {
			const config = createConfig(15, 5);
			const service = new SessionTimeoutService('test-session', config);

			const onTimeout = vi.fn();
			service.on('silenceTimeout', onTimeout);

			service.start();

			// Advance to silence timeout (5 minutes)
			vi.advanceTimersByTime(5 * 60 * 1000);

			expect(onTimeout).toHaveBeenCalledWith(
				expect.objectContaining({
					reason: 'silence_timeout',
				})
			);
		});

		it('should reset silence timer when speech is detected', () => {
			const config = createConfig(15, 5);
			const service = new SessionTimeoutService('test-session', config);

			const onTimeout = vi.fn();
			service.on('silenceTimeout', onTimeout);

			service.start();

			// Advance 4.5 minutes (close to timeout)
			vi.advanceTimersByTime(4.5 * 60 * 1000);

			// Speech detected - reset timer
			service.resetSilenceTimer();

			// Advance another 4 minutes
			vi.advanceTimersByTime(4 * 60 * 1000);

			// Should not have timed out yet
			expect(onTimeout).not.toHaveBeenCalled();

			// Advance to 5 minutes after reset
			vi.advanceTimersByTime(1 * 60 * 1000);

			// Now should have timed out
			expect(onTimeout).toHaveBeenCalledWith(
				expect.objectContaining({
					reason: 'silence_timeout',
				})
			);
		});

		it('should include silence timeout remaining in status', () => {
			const config = createConfig(15, 5);
			const service = new SessionTimeoutService('test-session', config);

			service.start();

			const status = service.getTimeoutStatus();
			expect(status.silenceTimeoutRemaining).toBe(5 * 60); // 5 minutes in seconds
		});

		it('should decrease silence timeout remaining over time', () => {
			const config = createConfig(15, 5);
			const service = new SessionTimeoutService('test-session', config);

			service.start();

			// Advance 2 minutes
			vi.advanceTimersByTime(2 * 60 * 1000);

			const status = service.getTimeoutStatus();
			expect(status.silenceTimeoutRemaining).toBe(3 * 60); // 3 minutes remaining
		});

		it('should reset silence timeout remaining after resetSilenceTimer', () => {
			const config = createConfig(15, 5);
			const service = new SessionTimeoutService('test-session', config);

			service.start();

			// Advance 3 minutes
			vi.advanceTimersByTime(3 * 60 * 1000);

			// Reset silence timer
			service.resetSilenceTimer();

			const status = service.getTimeoutStatus();
			expect(status.silenceTimeoutRemaining).toBe(5 * 60); // Back to 5 minutes
		});
	});

	describe('silence timeout disabled', () => {
		it('should not have silence timeout when set to null', () => {
			const config = createConfig(15, null);
			const service = new SessionTimeoutService('test-session', config);

			const onTimeout = vi.fn();
			service.on('silenceTimeout', onTimeout);

			service.start();

			// Advance 10 minutes
			vi.advanceTimersByTime(10 * 60 * 1000);

			// Should not have timed out due to silence
			expect(onTimeout).not.toHaveBeenCalled();
		});

		it('should return null for silence timeout remaining when disabled', () => {
			const config = createConfig(15, null);
			const service = new SessionTimeoutService('test-session', config);

			service.start();

			const status = service.getTimeoutStatus();
			expect(status.silenceTimeoutRemaining).toBeNull();
		});
	});

	describe('silence vs session timeout interaction', () => {
		it('should emit silence timeout before session timeout when silence occurs earlier', () => {
			const config = createConfig(15, 5);
			const service = new SessionTimeoutService('test-session', config);

			const onSilenceTimeout = vi.fn();
			const onSessionTimeout = vi.fn();
			service.on('silenceTimeout', onSilenceTimeout);
			service.on('sessionTimeout', onSessionTimeout);

			service.start();

			// Advance to silence timeout (5 minutes)
			vi.advanceTimersByTime(5 * 60 * 1000);

			expect(onSilenceTimeout).toHaveBeenCalled();
			expect(onSessionTimeout).not.toHaveBeenCalled();
		});

		it('should emit session timeout when silence timer is repeatedly reset', () => {
			const config = createConfig(3, 5); // Short session timeout for test
			const service = new SessionTimeoutService('test-session', config);

			const onSilenceTimeout = vi.fn();
			const onSessionTimeout = vi.fn();
			service.on('silenceTimeout', onSilenceTimeout);
			service.on('sessionTimeout', onSessionTimeout);

			service.start();

			// Keep resetting silence timer every minute
			for (let i = 0; i < 3; i++) {
				vi.advanceTimersByTime(1 * 60 * 1000);
				service.resetSilenceTimer();
			}

			// Session should timeout now (3 minutes elapsed)
			expect(onSessionTimeout).toHaveBeenCalled();
			expect(onSilenceTimeout).not.toHaveBeenCalled();
		});

		it('should stop silence timer when session ends', () => {
			const config = createConfig(15, 5);
			const service = new SessionTimeoutService('test-session', config);

			const onTimeout = vi.fn();
			service.on('silenceTimeout', onTimeout);

			service.start();

			// Stop the session
			service.stop();

			// Advance past silence timeout
			vi.advanceTimersByTime(10 * 60 * 1000);

			// Should not have received any timeout events
			expect(onTimeout).not.toHaveBeenCalled();
		});
	});

	describe('silence warning', () => {
		it('should include remaining seconds in silence warning', () => {
			const config = createConfig(15, 5);
			const service = new SessionTimeoutService('test-session', config);

			const onWarning = vi.fn();
			service.on('silenceWarning', onWarning);

			service.start();

			// Advance to 1 minute before silence timeout (4 minutes)
			vi.advanceTimersByTime(4 * 60 * 1000);

			expect(onWarning).toHaveBeenCalledWith(
				expect.objectContaining({
					warningType: 'silence',
					remainingSeconds: 60,
					message: expect.stringContaining('発話'),
				})
			);
		});

		it('should only show silence warning once per silence period', () => {
			const config = createConfig(15, 5);
			const service = new SessionTimeoutService('test-session', config);

			const onWarning = vi.fn();
			service.on('silenceWarning', onWarning);

			service.start();

			// Advance to warning time
			vi.advanceTimersByTime(4 * 60 * 1000);

			expect(onWarning).toHaveBeenCalledTimes(1);

			// Advance some more (still in warning period)
			vi.advanceTimersByTime(30 * 1000);

			// Should still be just one warning
			expect(onWarning).toHaveBeenCalledTimes(1);
		});

		it('should show new silence warning after speech resets timer', () => {
			const config = createConfig(15, 5);
			const service = new SessionTimeoutService('test-session', config);

			const onWarning = vi.fn();
			service.on('silenceWarning', onWarning);

			service.start();

			// Advance to warning time
			vi.advanceTimersByTime(4 * 60 * 1000);

			expect(onWarning).toHaveBeenCalledTimes(1);

			// Speech detected - reset timer
			service.resetSilenceTimer();

			// Advance to new warning time
			vi.advanceTimersByTime(4 * 60 * 1000);

			expect(onWarning).toHaveBeenCalledTimes(2);
		});
	});
});
