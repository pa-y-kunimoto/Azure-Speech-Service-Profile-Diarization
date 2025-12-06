/**
 * Session Timeout Service
 *
 * Manages session and silence timeouts for WebSocket sessions.
 * Emits events for warnings, timeouts, and periodic status updates.
 */

import { EventEmitter } from 'node:events';

/**
 * Configuration for session timeouts
 */
export interface SessionTimeoutConfig {
	/** Session timeout in minutes, null = unlimited */
	sessionTimeoutMinutes: number | null;
	/** Silence timeout in minutes, null = disabled */
	silenceTimeoutMinutes: number | null;
	/** Warning before timeout in seconds */
	warningBeforeSeconds: number;
}

/**
 * Runtime state for session timeout
 */
export interface SessionTimeoutState {
	/** Session identifier */
	sessionId: string;
	/** Session start time (Unix ms) */
	sessionStartedAt: number;
	/** Session timeout time (Unix ms), null = unlimited */
	sessionTimeoutAt: number | null;
	/** Last speech detection time (Unix ms) */
	lastSpeechAt: number;
	/** Silence timeout time (Unix ms), null = disabled */
	silenceTimeoutAt: number | null;
	/** Whether session timeout warning has been shown */
	sessionWarningShown: boolean;
	/** Whether silence timeout warning has been shown */
	silenceWarningShown: boolean;
	/** Whether session is paused */
	isPaused: boolean;
}

/**
 * Timeout warning event data
 */
export interface TimeoutWarning {
	/** Type of warning */
	warningType: 'session' | 'silence';
	/** Remaining seconds until timeout */
	remainingSeconds: number;
	/** User-friendly message */
	message: string;
}

/**
 * Timeout status for client updates
 */
export interface TimeoutStatus {
	/** Seconds remaining until session timeout, null = unlimited */
	sessionTimeoutRemaining: number | null;
	/** Seconds remaining until silence timeout, null = disabled */
	silenceTimeoutRemaining: number | null;
}

/**
 * Timeout end event data
 */
export interface TimeoutEndEvent {
	/** Reason for timeout */
	reason: 'session_timeout' | 'silence_timeout';
	/** User-friendly message */
	message: string;
}

/**
 * Event types emitted by SessionTimeoutService
 */
export interface SessionTimeoutEvents {
	sessionWarning: (warning: TimeoutWarning) => void;
	silenceWarning: (warning: TimeoutWarning) => void;
	sessionTimeout: (event: TimeoutEndEvent) => void;
	silenceTimeout: (event: TimeoutEndEvent) => void;
	tick: (status: TimeoutStatus) => void;
}

/**
 * Session Timeout Service
 *
 * Manages session and silence timeouts with event-based notification.
 */
export class SessionTimeoutService extends EventEmitter {
	private config: SessionTimeoutConfig;
	private state: SessionTimeoutState;
	private tickInterval: NodeJS.Timeout | null = null;
	private isRunning = false;

	constructor(sessionId: string, config: SessionTimeoutConfig) {
		super();
		this.config = config;
		this.state = {
			sessionId,
			sessionStartedAt: 0,
			sessionTimeoutAt: null,
			lastSpeechAt: 0,
			silenceTimeoutAt: null,
			sessionWarningShown: false,
			silenceWarningShown: false,
			isPaused: false,
		};
	}

	/**
	 * Start timeout tracking
	 */
	start(): void {
		if (this.isRunning) return;

		const now = Date.now();
		this.state.sessionStartedAt = now;
		this.state.lastSpeechAt = now;

		// Calculate session timeout
		if (this.config.sessionTimeoutMinutes !== null) {
			this.state.sessionTimeoutAt = now + this.config.sessionTimeoutMinutes * 60 * 1000;
		} else {
			this.state.sessionTimeoutAt = null;
		}

		// Calculate silence timeout
		if (this.config.silenceTimeoutMinutes !== null) {
			this.state.silenceTimeoutAt = now + this.config.silenceTimeoutMinutes * 60 * 1000;
		} else {
			this.state.silenceTimeoutAt = null;
		}

		this.state.sessionWarningShown = false;
		this.state.silenceWarningShown = false;
		this.isRunning = true;

		// Start tick interval
		this.tickInterval = setInterval(() => this.tick(), 1000);
	}

	/**
	 * Stop timeout tracking
	 */
	stop(): void {
		this.isRunning = false;
		if (this.tickInterval) {
			clearInterval(this.tickInterval);
			this.tickInterval = null;
		}
	}

	/**
	 * Extend session timeout
	 *
	 * @returns true if extended, false if session timeout is unlimited
	 */
	extend(): boolean {
		if (this.config.sessionTimeoutMinutes === null) {
			return false;
		}

		const now = Date.now();
		this.state.sessionTimeoutAt = now + this.config.sessionTimeoutMinutes * 60 * 1000;
		this.state.sessionWarningShown = false;

		return true;
	}

	/**
	 * Reset silence timer (called when speech is detected)
	 */
	resetSilenceTimer(): void {
		if (this.config.silenceTimeoutMinutes === null) {
			return;
		}

		const now = Date.now();
		this.state.lastSpeechAt = now;
		this.state.silenceTimeoutAt = now + this.config.silenceTimeoutMinutes * 60 * 1000;
		this.state.silenceWarningShown = false;
	}

	/**
	 * Get current timeout status
	 */
	getTimeoutStatus(): TimeoutStatus {
		const now = Date.now();

		let sessionTimeoutRemaining: number | null = null;
		if (this.state.sessionTimeoutAt !== null) {
			sessionTimeoutRemaining = Math.max(0, Math.round((this.state.sessionTimeoutAt - now) / 1000));
		}

		let silenceTimeoutRemaining: number | null = null;
		if (this.state.silenceTimeoutAt !== null) {
			silenceTimeoutRemaining = Math.max(0, Math.round((this.state.silenceTimeoutAt - now) / 1000));
		}

		return {
			sessionTimeoutRemaining,
			silenceTimeoutRemaining,
		};
	}

	/**
	 * Get current state (for debugging/testing)
	 */
	getState(): SessionTimeoutState {
		return { ...this.state };
	}

	/**
	 * Get configuration
	 */
	getConfig(): SessionTimeoutConfig {
		return { ...this.config };
	}

	/**
	 * Tick handler - called every second
	 */
	private tick(): void {
		if (!this.isRunning) return;

		const now = Date.now();
		const status = this.getTimeoutStatus();

		// Check session timeout warning
		if (this.state.sessionTimeoutAt !== null && !this.state.sessionWarningShown) {
			const remainingMs = this.state.sessionTimeoutAt - now;
			const warningThresholdMs = this.config.warningBeforeSeconds * 1000;

			if (remainingMs <= warningThresholdMs && remainingMs > 0) {
				this.state.sessionWarningShown = true;
				const warning: TimeoutWarning = {
					warningType: 'session',
					remainingSeconds: Math.round(remainingMs / 1000),
					message: 'セッションがあと1分で終了します。延長しますか？',
				};
				this.emit('sessionWarning', warning);
			}
		}

		// Check session timeout
		if (this.state.sessionTimeoutAt !== null && now >= this.state.sessionTimeoutAt) {
			this.stop();
			const event: TimeoutEndEvent = {
				reason: 'session_timeout',
				message: 'セッション時間が終了しました。',
			};
			this.emit('sessionTimeout', event);
			return;
		}

		// Check silence timeout warning
		if (this.state.silenceTimeoutAt !== null && !this.state.silenceWarningShown) {
			const remainingMs = this.state.silenceTimeoutAt - now;
			const warningThresholdMs = this.config.warningBeforeSeconds * 1000;

			if (remainingMs <= warningThresholdMs && remainingMs > 0) {
				this.state.silenceWarningShown = true;
				const warning: TimeoutWarning = {
					warningType: 'silence',
					remainingSeconds: Math.round(remainingMs / 1000),
					message: '1分間発話が検出されていません。発話するとセッションが継続します。',
				};
				this.emit('silenceWarning', warning);
			}
		}

		// Check silence timeout
		if (this.state.silenceTimeoutAt !== null && now >= this.state.silenceTimeoutAt) {
			this.stop();
			const event: TimeoutEndEvent = {
				reason: 'silence_timeout',
				message: '無音のためセッションを終了しました。',
			};
			this.emit('silenceTimeout', event);
			return;
		}

		// Emit tick event
		this.emit('tick', status);
	}
}
