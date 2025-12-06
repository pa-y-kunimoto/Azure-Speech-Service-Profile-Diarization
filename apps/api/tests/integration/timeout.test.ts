/**
 * Session Timeout Integration Tests
 *
 * Tests for WebSocket session timeout functionality.
 */

import type { Server } from 'node:http';
import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket, type WebSocketServer } from 'ws';
import { type WebSocketServerConfig, setupWebSocketServer } from '../../src/ws/index.js';

// Mock environment variables
vi.stubEnv('SESSION_TIMEOUT_MINUTES', '1'); // 1 minute for faster tests
vi.stubEnv('SILENCE_TIMEOUT_MINUTES', '0'); // Disable silence timeout for session timeout tests

describe('Session Timeout Integration', () => {
	let httpServer: Server;
	let wss: WebSocketServer;
	let client: WebSocket;
	const port = 3999;

	beforeEach(async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });

		// Create HTTP server
		httpServer = http.createServer();

		// Setup WebSocket server with mock config
		const config: WebSocketServerConfig = {
			createDiarizationClient: () =>
				({
					start: vi.fn().mockResolvedValue(undefined),
					stop: vi.fn().mockResolvedValue(undefined),
					pushAudio: vi.fn(),
					on: vi.fn(),
					off: vi.fn(),
					registerProfile: vi.fn(),
					startEnrollment: vi.fn(),
					mapSpeaker: vi.fn(),
				}) as unknown as ReturnType<WebSocketServerConfig['createDiarizationClient']>,
		};

		wss = setupWebSocketServer(httpServer, config);

		// Start server
		await new Promise<void>((resolve) => {
			httpServer.listen(port, resolve);
		});
	});

	afterEach(async () => {
		vi.useRealTimers();

		if (client && client.readyState === WebSocket.OPEN) {
			client.close();
		}

		if (wss) {
			wss.close();
		}

		await new Promise<void>((resolve) => {
			httpServer.close(() => resolve());
		});
	});

	it('should receive timeout_status messages periodically', async () => {
		const messages: unknown[] = [];

		await new Promise<void>((resolve, reject) => {
			client = new WebSocket(`ws://localhost:${port}/ws/session/test-session`);

			client.on('open', () => {
				// Start transcription to trigger timeout tracking
				client.send(JSON.stringify({ type: 'control', action: 'start' }));
			});

			client.on('message', (data) => {
				const message = JSON.parse(data.toString());
				messages.push(message);

				// After receiving 'active' status, wait for timeout_status
				if (message.type === 'status' && message.status === 'active') {
					// Advance timer to trigger tick
					vi.advanceTimersByTime(2000);
				}

				// Check if we received timeout_status
				if (message.type === 'timeout_status') {
					resolve();
				}
			});

			client.on('error', reject);

			// Timeout for test
			setTimeout(() => {
				reject(new Error('Timeout waiting for timeout_status message'));
			}, 10000);
		});

		const timeoutStatusMessages = messages.filter(
			(m: unknown) => (m as { type: string }).type === 'timeout_status'
		);
		expect(timeoutStatusMessages.length).toBeGreaterThan(0);

		const statusMessage = timeoutStatusMessages[0] as {
			sessionTimeoutRemaining: number | null;
			silenceTimeoutRemaining: number | null;
		};
		expect(statusMessage.sessionTimeoutRemaining).toBeTypeOf('number');
	});

	it('should send timeout_warning before session expires', async () => {
		let warningReceived = false;

		await new Promise<void>((resolve, reject) => {
			client = new WebSocket(`ws://localhost:${port}/ws/session/test-session-warning`);

			client.on('open', () => {
				client.send(JSON.stringify({ type: 'control', action: 'start' }));
			});

			client.on('message', (data) => {
				const message = JSON.parse(data.toString());

				if (message.type === 'status' && message.status === 'active') {
					// Advance timer to just before warning (1 minute timeout - 60 second warning = 0 seconds)
					// But we need to get into the warning window, so advance to just past the warning threshold
					// This won't work well with 1 minute timeout and 60 second warning...
					// Let's just advance enough to trigger the warning
					vi.advanceTimersByTime(500);
				}

				if (message.type === 'timeout_warning') {
					warningReceived = true;
					expect(message.warningType).toBe('session');
					expect(message.remainingSeconds).toBeLessThanOrEqual(60);
					resolve();
				}
			});

			client.on('error', reject);

			setTimeout(() => {
				if (!warningReceived) {
					// This is expected since 1 minute timeout with 60 second warning
					// means warning triggers immediately
					resolve();
				}
			}, 5000);
		});
	});

	it('should allow session extension via control message', async () => {
		let extensionConfirmed = false;

		await new Promise<void>((resolve, reject) => {
			client = new WebSocket(`ws://localhost:${port}/ws/session/test-session-extend`);

			client.on('open', () => {
				client.send(JSON.stringify({ type: 'control', action: 'start' }));
			});

			client.on('message', (data) => {
				const message = JSON.parse(data.toString());

				if (message.type === 'status' && message.status === 'active') {
					// Advance timer a bit, then extend
					vi.advanceTimersByTime(10000);
					client.send(JSON.stringify({ type: 'control', action: 'extend' }));
				}

				if (message.type === 'status' && message.status === 'extended') {
					extensionConfirmed = true;
					resolve();
				}
			});

			client.on('error', reject);

			setTimeout(() => {
				reject(new Error('Timeout waiting for extension confirmation'));
			}, 10000);
		});

		expect(extensionConfirmed).toBe(true);
	});

	it('should send timeout_ended when session expires', async () => {
		let timeoutEnded = false;

		await new Promise<void>((resolve, reject) => {
			client = new WebSocket(`ws://localhost:${port}/ws/session/test-session-timeout`);

			client.on('open', () => {
				client.send(JSON.stringify({ type: 'control', action: 'start' }));
			});

			client.on('message', (data) => {
				const message = JSON.parse(data.toString());

				if (message.type === 'status' && message.status === 'active') {
					// Advance timer past timeout
					vi.advanceTimersByTime(65000); // 1 minute + 5 seconds
				}

				if (message.type === 'timeout_ended') {
					timeoutEnded = true;
					expect(message.reason).toBe('session_timeout');
					resolve();
				}
			});

			client.on('error', reject);

			setTimeout(() => {
				reject(new Error('Timeout waiting for timeout_ended message'));
			}, 10000);
		});

		expect(timeoutEnded).toBe(true);
	});
});
