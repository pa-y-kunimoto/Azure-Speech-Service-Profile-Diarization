/**
 * WebSocket Server Setup
 *
 * Configures WebSocket server for real-time audio transcription.
 * Handles connection management and message routing.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { WebSocketHandler } from './handler.js';
import { RealtimeService, type Utterance } from '../services/realtimeService.js';
import type { DiarizationClient } from '@speaker-diarization/speech-client';

// Session store - maps sessionId to their services
const sessions: Map<string, { handler: WebSocketHandler; service: RealtimeService }> = new Map();

// Client store - maps sessionId to connected WebSocket clients
const clients: Map<string, Set<WebSocket>> = new Map();

export interface WebSocketServerConfig {
	createDiarizationClient: (sessionId: string) => DiarizationClient;
}

/**
 * Setup WebSocket server on existing HTTP server
 */
export function setupWebSocketServer(server: Server, config: WebSocketServerConfig): WebSocketServer {
	const wss = new WebSocketServer({
		server,
		// Don't use path option - handle path parsing manually for dynamic sessionId
	});

	wss.on('connection', (ws: WebSocket, request) => {
		// Extract sessionId from URL: /ws/session/{sessionId}
		const url = new URL(request.url || '', `http://${request.headers.host}`);
		const pathParts = url.pathname.split('/');
		
		// Validate path format: /ws/session/{sessionId}
		if (pathParts.length < 4 || pathParts[1] !== 'ws' || pathParts[2] !== 'session') {
			ws.send(JSON.stringify({
				type: 'error',
				code: 'INVALID_PATH',
				message: 'Invalid WebSocket path. Use /ws/session/{sessionId}',
				recoverable: false,
			}));
			ws.close();
			return;
		}
		
		const sessionId = pathParts[3];

		if (!sessionId || sessionId === 'session') {
			ws.send(JSON.stringify({
				type: 'error',
				code: 'INVALID_SESSION',
				message: 'Session ID is required',
				recoverable: false,
			}));
			ws.close();
			return;
		}

		console.log(`WebSocket connected: session=${sessionId}`);

		// Add client to session
		if (!clients.has(sessionId)) {
			clients.set(sessionId, new Set());
		}
		clients.get(sessionId)?.add(ws);

		// Create or get session handler
		let sessionData = sessions.get(sessionId);

		if (!sessionData) {
			// Create new session
			const diarizationClient = config.createDiarizationClient(sessionId);

			const sendToClient = (message: object) => {
				const messageStr = JSON.stringify(message);
				const sessionClients = clients.get(sessionId);
				if (sessionClients) {
					for (const client of sessionClients) {
						if (client.readyState === WebSocket.OPEN) {
							client.send(messageStr);
						}
					}
				}
			};

			const handler = new WebSocketHandler(sessionId, sendToClient);
			const service = new RealtimeService(diarizationClient, sessionId);

			// Connect service events to handler
			service.on('transcribing', (utterance: unknown) => {
				const u = utterance as Utterance;
				sendToClient({
					type: 'transcription',
					utterance: { ...u, isFinal: false },
				});
			});

			service.on('transcribed', (utterance: unknown) => {
				const u = utterance as Utterance;
				sendToClient({
					type: 'transcription',
					utterance: { ...u, isFinal: true },
				});
			});

			service.on('speakerDetected', (speakerId: unknown) => {
				sendToClient({
					type: 'speaker_detected',
					speakerId: speakerId as string,
				});
			});

			service.on('error', (error: unknown) => {
				const e = error as { code: string; message: string; recoverable: boolean };
				sendToClient({
					type: 'error',
					...e,
				});
			});

			// Handle speaker mapping events
			service.on('speakerMapped', (data: unknown) => {
				const mapping = data as { speakerId: string; profileId: string; profileName: string };
				sendToClient({
					type: 'speaker_registered',
					mapping: {
						speakerId: mapping.speakerId,
						profileId: mapping.profileId,
						profileName: mapping.profileName,
						isRegistered: true,
					},
				});
			});

			// Handle enrollment complete
			service.on('enrollmentComplete', (data: unknown) => {
				const result = data as { enrolled: number; mapped: number };
				sendToClient({
					type: 'status',
					status: 'enrollment_complete',
					message: `${result.enrolled}件中${result.mapped}件のプロフィールをマッピングしました`,
				});
			});

			// Handle enrollment warnings (e.g., profile audio didn't detect any speaker)
			service.on('enrollmentWarning', (data: unknown) => {
				const warning = data as { profileId: string; profileName: string; message: string };
				sendToClient({
					type: 'enrollment_warning',
					profileId: warning.profileId,
					profileName: warning.profileName,
					message: warning.message,
				});
			});

			// Set up audio forwarding
			handler.setTranscriptionCallback((chunk: Buffer) => {
				service.pushAudio(chunk);
			});

			// Set up control actions
			handler.setControlCallback(async (action: string, data?: unknown) => {
				switch (action) {
					case 'start':
						await service.start();
						break;
					case 'stop':
						await service.stop();
						break;
					case 'enroll': {
						// Register profiles and start enrollment
						const profiles = data as Array<{
							profileId: string;
							profileName: string;
							audioBase64: string;
						}>;
						if (profiles) {
							console.log(`[Enrollment] Received ${profiles.length} profile(s) for enrollment`);
							for (const profile of profiles) {
								console.log(`[Enrollment] Registering profile: ${profile.profileName}, audio size: ${profile.audioBase64?.length || 0} chars`);
								service.registerProfile(profile);
							}
							// Start transcription first, then enroll
							console.log('[Enrollment] Starting transcription...');
							await service.start();
							console.log('[Enrollment] Starting enrollment process...');
							await service.startEnrollment();
							console.log('[Enrollment] Enrollment process completed');
						}
						break;
					}
					case 'mapSpeaker': {
						// Manual speaker mapping
						const mapping = data as {
							speakerId: string;
							profileId: string;
							displayName: string;
						};
						if (mapping) {
							service.mapSpeaker(mapping.speakerId, mapping.profileId, mapping.displayName);
						}
						break;
					}
				}
			});

			sessionData = { handler, service };
			sessions.set(sessionId, sessionData);
		}

		// Send connected status
		ws.send(JSON.stringify({
			type: 'status',
			status: 'connected',
			message: 'WebSocket接続が確立されました',
			sessionId,
		}));

		// Handle incoming messages
		ws.on('message', (data) => {
			try {
				const message = data.toString();
				sessionData.handler.handleMessage(message);
			} catch (error) {
				console.error('Error handling WebSocket message:', error);
				ws.send(JSON.stringify({
					type: 'error',
					code: 'INTERNAL_ERROR',
					message: 'Failed to process message',
					recoverable: true,
				}));
			}
		});

		// Handle disconnection
		ws.on('close', () => {
			console.log(`WebSocket disconnected: session=${sessionId}`);

			const sessionClients = clients.get(sessionId);
			if (sessionClients) {
				sessionClients.delete(ws);

				// Clean up session if no more clients
				if (sessionClients.size === 0) {
					clients.delete(sessionId);
					const session = sessions.get(sessionId);
					if (session) {
						session.service.stop().catch(console.error);
						sessions.delete(sessionId);
					}
				}
			}
		});

		// Handle errors
		ws.on('error', (error) => {
			console.error(`WebSocket error: session=${sessionId}`, error);
		});
	});

	return wss;
}

/**
 * Get session service by ID
 */
export function getSessionService(sessionId: string): RealtimeService | undefined {
	return sessions.get(sessionId)?.service;
}

/**
 * Map speaker for a session
 */
export function mapSpeaker(
	sessionId: string,
	azureSpeakerId: string,
	profileId: string,
	displayName: string
): boolean {
	const sessionData = sessions.get(sessionId);
	if (!sessionData) {
		return false;
	}

	sessionData.service.mapSpeaker(azureSpeakerId, profileId, displayName);

	// Broadcast speaker mapping update
	const sessionClients = clients.get(sessionId);
	if (sessionClients) {
		const message = JSON.stringify({
			type: 'speaker_registered',
			mapping: {
				speakerId: azureSpeakerId,
				profileId,
				profileName: displayName,
				isRegistered: true,
			},
		});
		for (const client of sessionClients) {
			if (client.readyState === WebSocket.OPEN) {
				client.send(message);
			}
		}
	}

	return true;
}

/**
 * Close all connections for a session
 */
export function closeSession(sessionId: string): void {
	const sessionClients = clients.get(sessionId);
	if (sessionClients) {
		for (const client of sessionClients) {
			client.close();
		}
		clients.delete(sessionId);
	}

	const session = sessions.get(sessionId);
	if (session) {
		session.service.stop().catch(console.error);
		sessions.delete(sessionId);
	}
}
