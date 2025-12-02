/**
 * WebSocket Message Handler
 *
 * Handles incoming WebSocket messages for real-time transcription.
 * Processes audio and control messages according to the protocol.
 */

/**
 * Client to server message types
 */
interface AudioMessage {
	type: 'audio';
	data: string; // Base64 encoded
	timestamp: string;
}

interface ControlMessage {
	type: 'control';
	action: 'start' | 'stop' | 'pause' | 'resume';
}

type ClientMessage = AudioMessage | ControlMessage;

/**
 * Server to client message types
 */
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

type SendCallback = (message: ServerMessage) => void;
type TranscriptionCallback = (chunk: Buffer) => void;
type ControlCallback = (action: string) => Promise<void>;

/**
 * WebSocket message handler for a single session
 */
export class WebSocketHandler {
	private sessionId: string;
	private isActive = false;
	private sendCallback: SendCallback;
	private transcriptionCallback?: TranscriptionCallback;
	private controlCallback?: ControlCallback;

	constructor(sessionId: string, sendCallback: SendCallback) {
		this.sessionId = sessionId;
		this.sendCallback = sendCallback;
	}

	/**
	 * Check if currently active (transcribing)
	 */
	get active(): boolean {
		return this.isActive;
	}

	/**
	 * Get session ID
	 */
	getSessionId(): string {
		return this.sessionId;
	}

	/**
	 * Set callback for audio data
	 */
	setTranscriptionCallback(callback: TranscriptionCallback): void {
		this.transcriptionCallback = callback;
	}

	/**
	 * Set callback for control actions
	 */
	setControlCallback(callback: ControlCallback): void {
		this.controlCallback = callback;
	}

	/**
	 * Handle incoming message
	 */
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
					message: `Unknown message type: ${(message as { type: string }).type}`,
					recoverable: true,
				});
		}
	}

	/**
	 * Handle audio message
	 */
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

	/**
	 * Handle control message
	 */
	private async handleControlMessage(message: ControlMessage): Promise<void> {
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
				try {
					if (this.controlCallback) {
						await this.controlCallback('start');
					}
					this.isActive = true;
					this.sendCallback({
						type: 'status',
						status: 'active',
						message: 'リアルタイム認識を開始しました',
					});
				} catch (error) {
					this.sendCallback({
						type: 'error',
						code: 'AZURE_ERROR',
						message: `Failed to start transcription: ${error instanceof Error ? error.message : 'Unknown error'}`,
						recoverable: true,
					});
				}
				break;

			case 'stop':
				try {
					if (this.controlCallback) {
						await this.controlCallback('stop');
					}
					this.isActive = false;
					this.sendCallback({
						type: 'status',
						status: 'ended',
						message: 'リアルタイム認識を終了しました',
					});
				} catch (error) {
					this.sendCallback({
						type: 'error',
						code: 'AZURE_ERROR',
						message: `Failed to stop transcription: ${error instanceof Error ? error.message : 'Unknown error'}`,
						recoverable: true,
					});
				}
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
					message: `Unknown control action: ${(message as { action: string }).action}`,
					recoverable: true,
				});
		}
	}

	/**
	 * Send transcription result
	 */
	sendTranscription(utterance: TranscriptionMessage['utterance']): void {
		this.sendCallback({
			type: 'transcription',
			utterance,
		});
	}

	/**
	 * Send speaker registered notification
	 */
	sendSpeakerRegistered(mapping: SpeakerRegisteredMessage['mapping']): void {
		this.sendCallback({
			type: 'speaker_registered',
			mapping,
		});
	}

	/**
	 * Send error
	 */
	sendError(code: string, message: string, recoverable: boolean): void {
		this.sendCallback({
			type: 'error',
			code,
			message,
			recoverable,
		});
	}

	/**
	 * Close handler
	 */
	close(): void {
		this.isActive = false;
	}
}
