/**
 * WebSocket Handler Unit Tests
 *
 * Tests for WebSocket message handling for real-time transcription.
 * Covers audio/control message processing, event emission, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock types for WebSocket messages
interface AudioMessage {
	type: 'audio';
	data: string; // Base64 encoded
	timestamp: string;
}

interface ControlMessage {
	type: 'control';
	action: 'start' | 'stop' | 'pause' | 'resume';
}

interface TranscriptionMessage {
	type: 'transcription';
	utterance: {
		id: string;
		text: string;
		speakerId: string;
		speakerName: string;
		timestamp: string;
		offsetMs: number;
		confidence: number;
		isFinal: boolean;
	};
}

interface StatusMessage {
	type: 'status';
	status: string;
	message?: string;
}

interface ErrorMessage {
	type: 'error';
	code: string;
	message: string;
	recoverable: boolean;
}

interface SpeakerRegisteredMessage {
	type: 'speaker_registered';
	mapping: {
		speakerId: string;
		profileId: string;
		profileName: string;
		isRegistered: boolean;
	};
}

type ServerMessage =
	| TranscriptionMessage
	| StatusMessage
	| ErrorMessage
	| SpeakerRegisteredMessage;
type ClientMessage = AudioMessage | ControlMessage;

// WebSocket Handler class (to be implemented)
class WebSocketHandler {
	private sessionId: string;
	private isActive = false;
	private sendCallback: (message: ServerMessage) => void;
	private transcriptionCallback?: (chunk: Buffer) => void;

	constructor(
		sessionId: string,
		sendCallback: (message: ServerMessage) => void
	) {
		this.sessionId = sessionId;
		this.sendCallback = sendCallback;
	}

	get active(): boolean {
		return this.isActive;
	}

	getSessionId(): string {
		return this.sessionId;
	}

	setTranscriptionCallback(callback: (chunk: Buffer) => void): void {
		this.transcriptionCallback = callback;
	}

	handleMessage(rawMessage: string): void {
		let message: ClientMessage;

		try {
			message = JSON.parse(rawMessage);
		} catch {
			this.sendCallback({
				type: 'error',
				code: 'INVALID_MESSAGE',
				message: 'Invalid JSON format',
				recoverable: true,
			});
			return;
		}

		if (!message.type) {
			this.sendCallback({
				type: 'error',
				code: 'INVALID_MESSAGE',
				message: 'Message type is required',
				recoverable: true,
			});
			return;
		}

		switch (message.type) {
			case 'audio':
				this.handleAudioMessage(message as AudioMessage);
				break;
			case 'control':
				this.handleControlMessage(message as ControlMessage);
				break;
			default:
				this.sendCallback({
					type: 'error',
					code: 'INVALID_MESSAGE',
					message: `Unknown message type: ${message.type}`,
					recoverable: true,
				});
		}
	}

	private handleAudioMessage(message: AudioMessage): void {
		if (!this.isActive) {
			this.sendCallback({
				type: 'error',
				code: 'INVALID_MESSAGE',
				message: 'Transcription not started',
				recoverable: true,
			});
			return;
		}

		if (!message.data) {
			this.sendCallback({
				type: 'error',
				code: 'INVALID_MESSAGE',
				message: 'Audio data is required',
				recoverable: true,
			});
			return;
		}

		try {
			const audioBuffer = Buffer.from(message.data, 'base64');
			if (this.transcriptionCallback) {
				this.transcriptionCallback(audioBuffer);
			}
		} catch {
			this.sendCallback({
				type: 'error',
				code: 'INVALID_MESSAGE',
				message: 'Invalid Base64 audio data',
				recoverable: true,
			});
		}
	}

	private handleControlMessage(message: ControlMessage): void {
		switch (message.action) {
			case 'start':
				if (this.isActive) {
					this.sendCallback({
						type: 'error',
						code: 'INVALID_MESSAGE',
						message: 'Transcription already started',
						recoverable: true,
					});
					return;
				}
				this.isActive = true;
				this.sendCallback({
					type: 'status',
					status: 'active',
					message: 'リアルタイム認識を開始しました',
				});
				break;

			case 'stop':
				this.isActive = false;
				this.sendCallback({
					type: 'status',
					status: 'ended',
					message: 'リアルタイム認識を終了しました',
				});
				break;

			case 'pause':
				if (!this.isActive) {
					this.sendCallback({
						type: 'error',
						code: 'INVALID_MESSAGE',
						message: 'Transcription not active',
						recoverable: true,
					});
					return;
				}
				this.isActive = false;
				this.sendCallback({
					type: 'status',
					status: 'paused',
					message: '認識を一時停止しました',
				});
				break;

			case 'resume':
				if (this.isActive) {
					this.sendCallback({
						type: 'error',
						code: 'INVALID_MESSAGE',
						message: 'Transcription already active',
						recoverable: true,
					});
					return;
				}
				this.isActive = true;
				this.sendCallback({
					type: 'status',
					status: 'active',
					message: '認識を再開しました',
				});
				break;

			default:
				this.sendCallback({
					type: 'error',
					code: 'INVALID_MESSAGE',
					message: `Unknown control action: ${message.action}`,
					recoverable: true,
				});
		}
	}

	sendTranscription(utterance: TranscriptionMessage['utterance']): void {
		this.sendCallback({
			type: 'transcription',
			utterance,
		});
	}

	sendSpeakerRegistered(mapping: SpeakerRegisteredMessage['mapping']): void {
		this.sendCallback({
			type: 'speaker_registered',
			mapping,
		});
	}

	sendError(code: string, message: string, recoverable: boolean): void {
		this.sendCallback({
			type: 'error',
			code,
			message,
			recoverable,
		});
	}

	close(): void {
		this.isActive = false;
	}
}

describe('WebSocketHandler', () => {
	let handler: WebSocketHandler;
	let sendMock: ReturnType<typeof vi.fn>;
	const testSessionId = 'test-session-123';

	beforeEach(() => {
		sendMock = vi.fn();
		handler = new WebSocketHandler(testSessionId, sendMock);
	});

	afterEach(() => {
		handler.close();
		vi.clearAllMocks();
	});

	describe('initialization', () => {
		it('should initialize with session ID', () => {
			expect(handler.getSessionId()).toBe(testSessionId);
		});

		it('should start in inactive state', () => {
			expect(handler.active).toBe(false);
		});
	});

	describe('message parsing', () => {
		it('should handle invalid JSON gracefully', () => {
			handler.handleMessage('not valid json');

			expect(sendMock).toHaveBeenCalledWith({
				type: 'error',
				code: 'INVALID_MESSAGE',
				message: 'Invalid JSON format',
				recoverable: true,
			});
		});

		it('should require message type', () => {
			handler.handleMessage(JSON.stringify({ data: 'test' }));

			expect(sendMock).toHaveBeenCalledWith({
				type: 'error',
				code: 'INVALID_MESSAGE',
				message: 'Message type is required',
				recoverable: true,
			});
		});

		it('should reject unknown message types', () => {
			handler.handleMessage(JSON.stringify({ type: 'unknown' }));

			expect(sendMock).toHaveBeenCalledWith({
				type: 'error',
				code: 'INVALID_MESSAGE',
				message: 'Unknown message type: unknown',
				recoverable: true,
			});
		});
	});

	describe('control messages', () => {
		describe('start action', () => {
			it('should start transcription and send active status', () => {
				handler.handleMessage(
					JSON.stringify({ type: 'control', action: 'start' })
				);

				expect(sendMock).toHaveBeenCalledWith({
					type: 'status',
					status: 'active',
					message: 'リアルタイム認識を開始しました',
				});
				expect(handler.active).toBe(true);
			});

			it('should reject start when already active', () => {
				handler.handleMessage(
					JSON.stringify({ type: 'control', action: 'start' })
				);
				sendMock.mockClear();

				handler.handleMessage(
					JSON.stringify({ type: 'control', action: 'start' })
				);

				expect(sendMock).toHaveBeenCalledWith({
					type: 'error',
					code: 'INVALID_MESSAGE',
					message: 'Transcription already started',
					recoverable: true,
				});
			});
		});

		describe('stop action', () => {
			it('should stop transcription and send ended status', () => {
				handler.handleMessage(
					JSON.stringify({ type: 'control', action: 'start' })
				);
				sendMock.mockClear();

				handler.handleMessage(
					JSON.stringify({ type: 'control', action: 'stop' })
				);

				expect(sendMock).toHaveBeenCalledWith({
					type: 'status',
					status: 'ended',
					message: 'リアルタイム認識を終了しました',
				});
				expect(handler.active).toBe(false);
			});
		});

		describe('pause action', () => {
			it('should pause active transcription', () => {
				handler.handleMessage(
					JSON.stringify({ type: 'control', action: 'start' })
				);
				sendMock.mockClear();

				handler.handleMessage(
					JSON.stringify({ type: 'control', action: 'pause' })
				);

				expect(sendMock).toHaveBeenCalledWith({
					type: 'status',
					status: 'paused',
					message: '認識を一時停止しました',
				});
				expect(handler.active).toBe(false);
			});

			it('should reject pause when not active', () => {
				handler.handleMessage(
					JSON.stringify({ type: 'control', action: 'pause' })
				);

				expect(sendMock).toHaveBeenCalledWith({
					type: 'error',
					code: 'INVALID_MESSAGE',
					message: 'Transcription not active',
					recoverable: true,
				});
			});
		});

		describe('resume action', () => {
			it('should resume paused transcription', () => {
				handler.handleMessage(
					JSON.stringify({ type: 'control', action: 'start' })
				);
				handler.handleMessage(
					JSON.stringify({ type: 'control', action: 'pause' })
				);
				sendMock.mockClear();

				handler.handleMessage(
					JSON.stringify({ type: 'control', action: 'resume' })
				);

				expect(sendMock).toHaveBeenCalledWith({
					type: 'status',
					status: 'active',
					message: '認識を再開しました',
				});
				expect(handler.active).toBe(true);
			});

			it('should reject resume when already active', () => {
				handler.handleMessage(
					JSON.stringify({ type: 'control', action: 'start' })
				);
				sendMock.mockClear();

				handler.handleMessage(
					JSON.stringify({ type: 'control', action: 'resume' })
				);

				expect(sendMock).toHaveBeenCalledWith({
					type: 'error',
					code: 'INVALID_MESSAGE',
					message: 'Transcription already active',
					recoverable: true,
				});
			});
		});

		it('should reject unknown control actions', () => {
			handler.handleMessage(
				JSON.stringify({ type: 'control', action: 'invalid' })
			);

			expect(sendMock).toHaveBeenCalledWith({
				type: 'error',
				code: 'INVALID_MESSAGE',
				message: 'Unknown control action: invalid',
				recoverable: true,
			});
		});
	});

	describe('audio messages', () => {
		it('should reject audio when not active', () => {
			handler.handleMessage(
				JSON.stringify({
					type: 'audio',
					data: Buffer.from('test').toString('base64'),
					timestamp: new Date().toISOString(),
				})
			);

			expect(sendMock).toHaveBeenCalledWith({
				type: 'error',
				code: 'INVALID_MESSAGE',
				message: 'Transcription not started',
				recoverable: true,
			});
		});

		it('should require audio data', () => {
			handler.handleMessage(
				JSON.stringify({ type: 'control', action: 'start' })
			);
			sendMock.mockClear();

			handler.handleMessage(
				JSON.stringify({
					type: 'audio',
					timestamp: new Date().toISOString(),
				})
			);

			expect(sendMock).toHaveBeenCalledWith({
				type: 'error',
				code: 'INVALID_MESSAGE',
				message: 'Audio data is required',
				recoverable: true,
			});
		});

		it('should decode Base64 audio and call transcription callback', () => {
			const transcriptionCallback = vi.fn();
			handler.setTranscriptionCallback(transcriptionCallback);

			handler.handleMessage(
				JSON.stringify({ type: 'control', action: 'start' })
			);

			const testAudio = Buffer.from([0x00, 0x01, 0x02, 0x03]);
			handler.handleMessage(
				JSON.stringify({
					type: 'audio',
					data: testAudio.toString('base64'),
					timestamp: new Date().toISOString(),
				})
			);

			expect(transcriptionCallback).toHaveBeenCalledWith(testAudio);
		});

		it('should handle empty audio data', () => {
			handler.handleMessage(
				JSON.stringify({ type: 'control', action: 'start' })
			);
			sendMock.mockClear();

			handler.handleMessage(
				JSON.stringify({
					type: 'audio',
					data: '',
					timestamp: new Date().toISOString(),
				})
			);

			// Empty string triggers "Audio data is required" error
			expect(sendMock).toHaveBeenCalledWith({
				type: 'error',
				code: 'INVALID_MESSAGE',
				message: 'Audio data is required',
				recoverable: true,
			});
		});
	});

	describe('outgoing messages', () => {
		it('should send transcription message', () => {
			const utterance = {
				id: 'test-id',
				text: 'こんにちは',
				speakerId: 'Guest-1',
				speakerName: '田中さん',
				timestamp: new Date().toISOString(),
				offsetMs: 1500,
				confidence: 0.95,
				isFinal: true,
			};

			handler.sendTranscription(utterance);

			expect(sendMock).toHaveBeenCalledWith({
				type: 'transcription',
				utterance,
			});
		});

		it('should send speaker registered message', () => {
			const mapping = {
				speakerId: 'Guest-1',
				profileId: 'profile-123',
				profileName: '田中さん',
				isRegistered: true,
			};

			handler.sendSpeakerRegistered(mapping);

			expect(sendMock).toHaveBeenCalledWith({
				type: 'speaker_registered',
				mapping,
			});
		});

		it('should send error message', () => {
			handler.sendError('AZURE_ERROR', 'Connection failed', true);

			expect(sendMock).toHaveBeenCalledWith({
				type: 'error',
				code: 'AZURE_ERROR',
				message: 'Connection failed',
				recoverable: true,
			});
		});
	});

	describe('cleanup', () => {
		it('should deactivate on close', () => {
			handler.handleMessage(
				JSON.stringify({ type: 'control', action: 'start' })
			);
			expect(handler.active).toBe(true);

			handler.close();

			expect(handler.active).toBe(false);
		});
	});
});
