/**
 * useRealtimeRecognition - Composable for real-time speech recognition
 *
 * Manages WebSocket connection to the transcription service.
 * Handles audio capture and streaming to the backend.
 */

import { computed, onUnmounted, ref } from 'vue';
import { useApiFetch } from './useApiFetch';

/**
 * Utterance data structure from the backend
 */
export interface Utterance {
	id: string;
	text: string;
	speakerId: string;
	speakerName: string;
	timestamp: string;
	offsetMs: number;
	confidence: number;
	isFinal: boolean;
	/** True if this utterance was extracted from an enrollment audio profile */
	isEnrollment?: boolean;
	/** Profile name if this is an enrollment utterance */
	enrollmentProfileName?: string;
}

/**
 * Speaker mapping data
 */
export interface SpeakerMapping {
	speakerId: string;
	profileId: string;
	profileName: string;
	isRegistered: boolean;
}

/**
 * Recognition status
 */
export type RecognitionStatus =
	| 'idle'
	| 'connecting'
	| 'connected'
	| 'active'
	| 'paused'
	| 'error'
	| 'ended';

/**
 * Error information
 */
export interface RecognitionError {
	code: string;
	message: string;
	recoverable: boolean;
}

/**
 * Timeout warning data from server
 */
export interface TimeoutWarning {
	warningType: 'session' | 'silence';
	remainingSeconds: number;
	message: string;
}

/**
 * Timeout state for session
 */
export interface TimeoutState {
	/** Seconds remaining until session timeout, null = unlimited */
	sessionTimeoutRemaining: number | null;
	/** Seconds remaining until silence timeout, null = disabled */
	silenceTimeoutRemaining: number | null;
	/** Current warning if any */
	warning: TimeoutWarning | null;
	/** Whether session timeout is enabled */
	isSessionTimeoutEnabled: boolean;
	/** Whether silence timeout is enabled */
	isSilenceTimeoutEnabled: boolean;
}

/**
 * Options for useRealtimeRecognition
 */
export interface UseRealtimeRecognitionOptions {
	sessionId: string;
	maxReconnectAttempts?: number;
	reconnectDelay?: number;
	onUtterance?: (utterance: Utterance) => void;
	onInterim?: (utterance: Utterance) => void;
	onSpeakerDetected?: (speakerId: string) => void;
	onError?: (error: RecognitionError) => void;
	onReconnecting?: (attempt: number, maxAttempts: number) => void;
	onReconnected?: () => void;
	onTimeoutWarning?: (warning: TimeoutWarning) => void;
	onTimeoutEnded?: (reason: 'session_timeout' | 'silence_timeout', message: string) => void;
}

/**
 * Composable for real-time speech recognition
 */
export function useRealtimeRecognition(options: UseRealtimeRecognitionOptions) {
	const {
		sessionId,
		maxReconnectAttempts = 3,
		reconnectDelay = 1000,
		onUtterance,
		onInterim,
		onSpeakerDetected,
		onError,
		onReconnecting,
		onReconnected,
		onTimeoutWarning,
		onTimeoutEnded,
	} = options;

	// Get WebSocket URL from API fetch helper
	const { getWebSocketUrl } = useApiFetch();

	// State
	const status = ref<RecognitionStatus>('idle');
	const utterances = ref<Utterance[]>([]);
	const interimText = ref('');
	const interimSpeaker = ref('');
	const detectedSpeakers = ref<string[]>([]);
	const speakerMappings = ref<SpeakerMapping[]>([]);
	const error = ref<RecognitionError | null>(null);

	// Timeout state
	const timeoutState = ref<TimeoutState>({
		sessionTimeoutRemaining: null,
		silenceTimeoutRemaining: null,
		warning: null,
		isSessionTimeoutEnabled: false,
		isSilenceTimeoutEnabled: false,
	});

	// WebSocket and MediaRecorder refs
	let socket: WebSocket | null = null;
	let mediaStream: MediaStream | null = null;
	let audioContext: AudioContext | null = null;
	let scriptProcessor: ScriptProcessorNode | null = null;
	let audioWorkletNode: AudioWorkletNode | null = null;
	let workletUrl: string | null = null;
	let workletGain: GainNode | null = null;
	let reconnectAttempts = 0;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let shouldReconnect = false;

	// Computed
	const isConnected = computed(() => status.value === 'connected' || status.value === 'active');
	const isActive = computed(() => status.value === 'active');
	const isRecording = computed(() => status.value === 'active');

	/**
	 * Connect to WebSocket server
	 */
	async function connect(): Promise<void> {
		if (socket?.readyState === WebSocket.OPEN) {
			return;
		}

		status.value = 'connecting';
		error.value = null;
		shouldReconnect = true;

		return new Promise((resolve, reject) => {
			const wsUrl = getWebSocketUrl(`/ws/session/${sessionId}`);
			socket = new WebSocket(wsUrl);

			socket.onopen = () => {
				console.log('WebSocket connected');
				status.value = 'connected';
				reconnectAttempts = 0; // Reset on successful connection
				if (onReconnected && reconnectAttempts > 0) {
					onReconnected();
				}
				resolve();
			};

			socket.onmessage = (event) => {
				handleMessage(event.data);
			};

			socket.onerror = (event) => {
				console.error('WebSocket error:', event);
				const err: RecognitionError = {
					code: 'CONNECTION_ERROR',
					message: 'WebSocket connection error',
					recoverable: true,
				};
				error.value = err;
				status.value = 'error';
				onError?.(err);
				reject(new Error('WebSocket connection error'));
			};

			socket.onclose = () => {
				console.log('WebSocket closed');
				if (status.value !== 'error' && status.value !== 'ended') {
					// Attempt reconnection if not intentionally closed
					if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
						attemptReconnect();
					} else {
						status.value = 'ended';
					}
				}
				cleanupAudio(); // Clean up audio resources but not socket
			};
		});
	}

	/**
	 * Attempt to reconnect to WebSocket server
	 */
	function attemptReconnect(): void {
		reconnectAttempts++;
		const delay = reconnectDelay * 2 ** (reconnectAttempts - 1); // Exponential backoff

		console.log(
			`Attempting reconnection (${reconnectAttempts}/${maxReconnectAttempts}) in ${delay}ms`
		);
		onReconnecting?.(reconnectAttempts, maxReconnectAttempts);

		reconnectTimer = setTimeout(async () => {
			try {
				await connect();
				// If we were active before disconnect, resume
				if (status.value === 'connected' && mediaStream) {
					await start();
				}
			} catch (err) {
				console.error('Reconnection failed:', err);
				if (reconnectAttempts >= maxReconnectAttempts) {
					const reconnectError: RecognitionError = {
						code: 'MAX_RECONNECT_ATTEMPTS',
						message: `Failed to reconnect after ${maxReconnectAttempts} attempts`,
						recoverable: false,
					};
					error.value = reconnectError;
					status.value = 'error';
					onError?.(reconnectError);
				}
			}
		}, delay);
	}

	/**
	 * Disconnect from WebSocket server
	 */
	function disconnect(): void {
		shouldReconnect = false;
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		if (socket) {
			socket.close();
			socket = null;
		}
		cleanup();
		status.value = 'idle';
	}

	/**
	 * Start recognition (microphone capture + transcription)
	 */
	async function start(): Promise<void> {
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			await connect();
		}

		// Start microphone capture
		await startMicrophoneCapture();

		// Send start command to begin transcription
		sendControlMessage('start');
	}

	/**
	 * Start microphone capture only (without sending start command)
	 * Use this after enrollment which already starts transcription
	 */
	async function startMicrophoneCapture(): Promise<void> {
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			await connect();
		}

		// Skip if already capturing
		if (mediaStream) {
			console.log('Microphone already capturing');
			return;
		}

		// Request microphone access
		try {
			mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					sampleRate: 16000,
					channelCount: 1,
					echoCancellation: true,
					noiseSuppression: true,
				},
			});
		} catch (err) {
			const mediaError: RecognitionError = {
				code: 'MICROPHONE_ERROR',
				message: 'Failed to access microphone',
				recoverable: false,
			};
			error.value = mediaError;
			onError?.(mediaError);
			throw err;
		}

		// Set up audio processing
		audioContext = new AudioContext({ sampleRate: 16000 });
		const source = audioContext.createMediaStreamSource(mediaStream);

		// Prefer AudioWorkletNode when available (modern, not deprecated)
		try {
			if (audioContext.audioWorklet && typeof audioContext.audioWorklet.addModule === 'function') {
				const workletCode = `class RecorderProcessor extends AudioWorkletProcessor{process(inputs){const input=inputs[0];if(input&&input[0]){this.port.postMessage(input[0]);}return true;}}registerProcessor('recorder-processor',RecorderProcessor);`;
				const blob = new Blob([workletCode], { type: 'application/javascript' });
				workletUrl = URL.createObjectURL(blob);
				await audioContext.audioWorklet.addModule(workletUrl);
				audioWorkletNode = new AudioWorkletNode(audioContext, 'recorder-processor', {
					numberOfInputs: 1,
					numberOfOutputs: 0,
					channelCount: 1,
				});
				audioWorkletNode.port.onmessage = (ev) => {
					if (status.value !== 'active') return;
					const float32 = ev.data as Float32Array;
					const pcmData = convertToInt16(float32);
					sendAudioChunk(pcmData);
				};

				// Keep processing by connecting to a silent gain node
				workletGain = audioContext.createGain();
				workletGain.gain.value = 0;
				source.connect(audioWorkletNode);
				audioWorkletNode.connect(workletGain);
				workletGain.connect(audioContext.destination);
				return;
			}
		} catch (err) {
			console.warn('AudioWorklet setup failed, falling back to ScriptProcessorNode', err);
		}

		// Fallback: ScriptProcessorNode (deprecated)
		scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

		scriptProcessor.onaudioprocess = (event) => {
			if (status.value !== 'active') return;

			const inputData = event.inputBuffer.getChannelData(0);
			const pcmData = convertToInt16(inputData);
			sendAudioChunk(pcmData);
		};

		source.connect(scriptProcessor);
		scriptProcessor.connect(audioContext.destination);
	}

	/**
	 * Stop recognition
	 */
	async function stop(): Promise<void> {
		sendControlMessage('stop');
		cleanup();
	}

	/**
	 * Pause recognition
	 */
	function pause(): void {
		sendControlMessage('pause');
	}

	/**
	 * Resume recognition
	 */
	function resume(): void {
		sendControlMessage('resume');
	}

	/**
	 * Profile data for enrollment
	 */
	interface EnrollmentProfile {
		profileId: string;
		profileName: string;
		audioBase64: string;
	}

	/**
	 * Enroll profiles - sends profile audio to learn speakers before real-time recognition
	 * This should be called after connect() and before start()
	 */
	async function enrollProfiles(profiles: EnrollmentProfile[]): Promise<void> {
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			await connect();
		}

		if (!profiles || profiles.length === 0) {
			console.warn('No profiles to enroll');
			return;
		}

		console.log(`Enrolling ${profiles.length} profile(s)`);

		socket?.send(
			JSON.stringify({
				type: 'control',
				action: 'enroll',
				profiles: profiles.map((p) => ({
					profileId: p.profileId,
					profileName: p.profileName,
					audioBase64: p.audioBase64,
				})),
			})
		);
	}

	/**
	 * Map a detected speaker to a profile
	 */
	function mapSpeaker(speakerId: string, profileId: string, displayName: string): void {
		// Update local state
		speakerMappings.value = [
			...speakerMappings.value.filter((m) => m.speakerId !== speakerId),
			{
				speakerId,
				profileId,
				profileName: displayName,
				isRegistered: true,
			},
		];

		// Send mapping to backend via WebSocket
		if (socket && socket.readyState === WebSocket.OPEN) {
			socket.send(
				JSON.stringify({
					type: 'control',
					action: 'mapSpeaker',
					speakerId,
					profileId,
					displayName,
				})
			);
		}
	}

	/**
	 * Convert Float32Array to Int16Array (PCM)
	 */
	function convertToInt16(float32Array: Float32Array): ArrayBuffer {
		const int16Array = new Int16Array(float32Array.length);
		for (let i = 0; i < float32Array.length; i++) {
			const s = Math.max(-1, Math.min(1, float32Array?.[i] || 0));
			int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
		}
		return int16Array.buffer;
	}

	/**
	 * Send audio chunk to server
	 */
	function sendAudioChunk(audioData: ArrayBuffer): void {
		if (!socket || socket.readyState !== WebSocket.OPEN) return;

		const base64 = arrayBufferToBase64(audioData);
		socket.send(
			JSON.stringify({
				type: 'audio',
				data: base64,
				timestamp: new Date().toISOString(),
			})
		);
	}

	/**
	 * Send control message to server
	 */
	function sendControlMessage(action: 'start' | 'stop' | 'pause' | 'resume'): void {
		if (!socket || socket.readyState !== WebSocket.OPEN) return;

		socket.send(
			JSON.stringify({
				type: 'control',
				action,
			})
		);
	}

	/**
	 * Handle incoming WebSocket message
	 */
	function handleMessage(data: string): void {
		try {
			const message = JSON.parse(data);

			switch (message.type) {
				case 'status':
					handleStatusMessage(message);
					break;
				case 'transcription':
					handleTranscriptionMessage(message);
					break;
				case 'speaker_detected':
					handleSpeakerDetectedMessage(message);
					break;
				case 'speaker_registered':
					handleSpeakerRegisteredMessage(message);
					break;
				case 'enrollment_warning':
					handleEnrollmentWarningMessage(message);
					break;
				case 'timeout_status':
					handleTimeoutStatusMessage(message);
					break;
				case 'timeout_warning':
					handleTimeoutWarningMessage(message);
					break;
				case 'timeout_ended':
					handleTimeoutEndedMessage(message);
					break;
				case 'error':
					handleErrorMessage(message);
					break;
				default:
					console.warn('Unknown message type:', message.type);
			}
		} catch (err) {
			console.error('Failed to parse message:', err);
		}
	}

	/**
	 * Handle status message
	 */
	function handleStatusMessage(message: { status: string; message?: string }): void {
		switch (message.status) {
			case 'connected':
				status.value = 'connected';
				break;
			case 'active':
				status.value = 'active';
				break;
			case 'paused':
				status.value = 'paused';
				break;
			case 'ended':
				status.value = 'ended';
				break;
		}
	}

	/**
	 * Handle transcription message
	 */
	function handleTranscriptionMessage(message: { utterance: Utterance }): void {
		const utterance = message.utterance;

		if (utterance.isFinal) {
			// Final result - add to utterances list
			utterances.value = [...utterances.value, utterance];
			interimText.value = '';
			interimSpeaker.value = '';
			onUtterance?.(utterance);
		} else {
			// Interim result - update interim text
			interimText.value = utterance.text;
			interimSpeaker.value = utterance.speakerName;
			onInterim?.(utterance);
		}
	}

	/**
	 * Handle speaker detected message
	 */
	function handleSpeakerDetectedMessage(message: { speakerId: string }): void {
		// Skip 'Unknown' speakers - they cannot be mapped to profiles
		if (message.speakerId === 'Unknown') {
			return;
		}
		if (!detectedSpeakers.value.includes(message.speakerId)) {
			detectedSpeakers.value = [...detectedSpeakers.value, message.speakerId];
			onSpeakerDetected?.(message.speakerId);
		}
	}

	/**
	 * Handle speaker registered message
	 */
	function handleSpeakerRegisteredMessage(message: { mapping: SpeakerMapping }): void {
		speakerMappings.value = [
			...speakerMappings.value.filter((m) => m.speakerId !== message.mapping.speakerId),
			message.mapping,
		];
	}

	/**
	 * Handle enrollment warning message
	 */
	function handleEnrollmentWarningMessage(message: {
		profileId: string;
		profileName: string;
		message: string;
	}): void {
		console.warn(`Enrollment warning for profile "${message.profileName}": ${message.message}`);
		// Optionally emit as a non-fatal error so the UI can display it
		const warningError: RecognitionError = {
			code: 'ENROLLMENT_WARNING',
			message: `${message.profileName}: ${message.message}`,
			recoverable: true,
		};
		onError?.(warningError);
	}

	/**
	 * Handle error message
	 */
	function handleErrorMessage(message: RecognitionError): void {
		error.value = message;
		onError?.(message);

		if (!message.recoverable) {
			status.value = 'error';
		}
	}

	/**
	 * Handle timeout status message
	 */
	function handleTimeoutStatusMessage(message: {
		sessionTimeoutRemaining: number | null;
		silenceTimeoutRemaining: number | null;
	}): void {
		timeoutState.value = {
			...timeoutState.value,
			sessionTimeoutRemaining: message.sessionTimeoutRemaining,
			silenceTimeoutRemaining: message.silenceTimeoutRemaining,
			isSessionTimeoutEnabled: message.sessionTimeoutRemaining !== null,
			isSilenceTimeoutEnabled: message.silenceTimeoutRemaining !== null,
		};
	}

	/**
	 * Handle timeout warning message
	 */
	function handleTimeoutWarningMessage(message: TimeoutWarning): void {
		timeoutState.value = {
			...timeoutState.value,
			warning: message,
		};
		onTimeoutWarning?.(message);
	}

	/**
	 * Handle timeout ended message
	 */
	function handleTimeoutEndedMessage(message: {
		reason: 'session_timeout' | 'silence_timeout';
		message: string;
	}): void {
		status.value = 'ended';
		timeoutState.value = {
			...timeoutState.value,
			warning: null,
		};
		onTimeoutEnded?.(message.reason, message.message);
	}

	/**
	 * Extend session timeout
	 */
	function extendSession(): void {
		if (!socket || socket.readyState !== WebSocket.OPEN) return;

		socket.send(
			JSON.stringify({
				type: 'control',
				action: 'extend',
			})
		);

		// Clear warning when extending
		timeoutState.value = {
			...timeoutState.value,
			warning: null,
		};
	}

	/**
	 * Convert ArrayBuffer to Base64
	 */
	function arrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes?.[i] || 0);
		}
		return btoa(binary);
	}

	/**
	 * Cleanup audio resources only
	 */
	function cleanupAudio(): void {
		if (scriptProcessor) {
			scriptProcessor.disconnect();
			scriptProcessor = null;
		}

		if (audioContext) {
			audioContext.close();
			audioContext = null;
		}

		if (mediaStream) {
			for (const track of mediaStream.getTracks()) {
				track.stop();
			}
			mediaStream = null;
		}
	}

	/**
	 * Cleanup all resources
	 */
	function cleanup(): void {
		cleanupAudio();
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
	}

	/**
	 * Clear all utterances
	 */
	function clearUtterances(): void {
		utterances.value = [];
		interimText.value = '';
		interimSpeaker.value = '';
	}

	// Cleanup on unmount
	onUnmounted(() => {
		disconnect();
	});

	return {
		// State
		status,
		utterances,
		interimText,
		interimSpeaker,
		detectedSpeakers,
		speakerMappings,
		error,
		timeoutState,

		// Computed
		isConnected,
		isActive,
		isRecording,

		// Methods
		connect,
		disconnect,
		start,
		startMicrophoneCapture,
		stop,
		pause,
		resume,
		enrollProfiles,
		mapSpeaker,
		clearUtterances,
		extendSession,
	};
}
