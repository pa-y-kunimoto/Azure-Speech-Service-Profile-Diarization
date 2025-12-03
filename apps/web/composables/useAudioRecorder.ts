/**
 * useAudioRecorder Composable
 *
 * Provides browser-based audio recording functionality using MediaRecorder API
 * with WAV conversion support for Azure Speech Service (16kHz, 16-bit, Mono)
 */

import { computed, onUnmounted, ref, type Ref } from 'vue';
import { convertToBase64Wav, convertToWavBlob } from '~/utils/wavEncoder';

export interface UseAudioRecorderOptions {
	/** Minimum recording duration in seconds (default: 5) */
	minDuration?: number;
}

export interface UseAudioRecorderReturn {
	/** Whether currently recording */
	isRecording: Ref<boolean>;
	/** Whether recording is paused */
	isPaused: Ref<boolean>;
	/** Current recording duration in seconds */
	duration: Ref<number>;
	/** Recorded audio blob (null until recording completes) */
	audioBlob: Ref<Blob | null>;
	/** Error message if any */
	error: Ref<string | null>;
	/** Microphone permission status: null = unknown, true = granted, false = denied */
	hasPermission: Ref<boolean | null>;
	/** Whether current duration meets minimum requirement */
	meetsMinDuration: Ref<boolean>;
	/** Current audio input level (0-1) for visualization */
	audioLevel: Ref<number>;
	/** Request microphone permission */
	requestPermission: () => Promise<boolean>;
	/** Start recording */
	startRecording: () => Promise<void>;
	/** Stop recording and return the recorded blob */
	stopRecording: () => Promise<Blob | null>;
	/** Pause recording */
	pauseRecording: () => void;
	/** Resume recording */
	resumeRecording: () => void;
	/** Cancel recording and discard data */
	cancelRecording: () => void;
	/** Reset all state */
	reset: () => void;
	/** Get recorded audio as WAV blob */
	getWavBlob: () => Promise<Blob | null>;
	/** Get recorded audio as base64 WAV string */
	getBase64Wav: () => Promise<string | null>;
}

export function useAudioRecorder(
	options: UseAudioRecorderOptions = {},
): UseAudioRecorderReturn {
	const { minDuration = 5 } = options;

	// State
	const isRecording = ref(false);
	const isPaused = ref(false);
	const duration = ref(0);
	const audioBlob = ref<Blob | null>(null);
	const error = ref<string | null>(null);
	const hasPermission = ref<boolean | null>(null);
	const audioLevel = ref(0);

	// Internal state
	let mediaRecorder: MediaRecorder | null = null;
	let mediaStream: MediaStream | null = null;
	let audioContext: AudioContext | null = null;
	let analyser: AnalyserNode | null = null;
	let durationTimer: ReturnType<typeof setInterval> | null = null;
	let levelTimer: ReturnType<typeof requestAnimationFrame> | null = null;
	const recordedChunks: Blob[] = [];

	// Computed
	const meetsMinDuration = computed(() => duration.value >= minDuration);

	/**
	 * Request microphone permission
	 */
	async function requestPermission(): Promise<boolean> {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			// Release the stream immediately - we just wanted to check permission
            for (const track of stream.getTracks()) {
                track.stop();
            }
			hasPermission.value = true;
			error.value = null;
			return true;
		} catch (err) {
			hasPermission.value = false;
			error.value =
				err instanceof Error ? err.message : 'Microphone permission denied';
			return false;
		}
	}

	/**
	 * Start audio level monitoring
	 */
	function startLevelMonitoring(stream: MediaStream): void {
		try {
			audioContext = new AudioContext();
			analyser = audioContext.createAnalyser();
			analyser.fftSize = 256;

			const source = audioContext.createMediaStreamSource(stream);
			source.connect(analyser);

			const dataArray = new Uint8Array(analyser.frequencyBinCount);

			function updateLevel() {
				if (!analyser || !isRecording.value) return;

				analyser.getByteFrequencyData(dataArray);

				// Calculate average level
				let sum = 0;
				for (let i = 0; i < dataArray.length; i++) {
					sum += dataArray[i] ?? 0;
				}
				const average = sum / dataArray.length;
				audioLevel.value = Math.min(1, average / 128);

				if (isRecording.value && !isPaused.value) {
					levelTimer = requestAnimationFrame(updateLevel);
				}
			}

			updateLevel();
		} catch {
			// Audio level monitoring is optional, don't fail if it doesn't work
			audioLevel.value = 0;
		}
	}

	/**
	 * Stop audio level monitoring
	 */
	function stopLevelMonitoring(): void {
		if (levelTimer) {
			cancelAnimationFrame(levelTimer);
			levelTimer = null;
		}
		if (audioContext) {
			audioContext.close().catch(() => {});
			audioContext = null;
		}
		analyser = null;
		audioLevel.value = 0;
	}

	/**
	 * Start recording
	 */
	async function startRecording(): Promise<void> {
		if (isRecording.value) return;

		try {
			error.value = null;
			recordedChunks.length = 0;

			// Request audio with preferred settings
			mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					channelCount: 1,
					sampleRate: 16000,
					echoCancellation: true,
					noiseSuppression: true,
				},
			});

			hasPermission.value = true;

			// Determine supported MIME type
			const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
				? 'audio/webm;codecs=opus'
				: MediaRecorder.isTypeSupported('audio/webm')
					? 'audio/webm'
					: undefined;

			mediaRecorder = new MediaRecorder(
				mediaStream,
				mimeType ? { mimeType } : undefined,
			);

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					recordedChunks.push(event.data);
				}
			};

			mediaRecorder.onerror = (event) => {
				error.value = `Recording error: ${(event as ErrorEvent).error?.message || 'Unknown error'}`;
				stopRecording();
			};

			// Start recording with timeslice for regular data chunks
			mediaRecorder.start(100);
			isRecording.value = true;
			isPaused.value = false;
			duration.value = 0;

			// Start duration timer
			durationTimer = setInterval(() => {
				if (!isPaused.value) {
					duration.value++;
				}
			}, 1000);

			// Start audio level monitoring
			startLevelMonitoring(mediaStream);
		} catch (err) {
			hasPermission.value = false;
			error.value =
				err instanceof Error ? err.message : 'Failed to start recording';
			isRecording.value = false;
		}
	}

	/**
	 * Stop recording and return the blob
	 */
	async function stopRecording(): Promise<Blob | null> {
		if (!isRecording.value || !mediaRecorder) {
			return null;
		}

		return new Promise((resolve) => {
			if (!mediaRecorder) {
				resolve(null);
				return;
			}

			mediaRecorder.onstop = () => {
				// Create blob from recorded chunks
				const blob = new Blob(recordedChunks, {
					type: mediaRecorder?.mimeType || 'audio/webm',
				});
				audioBlob.value = blob;

				// Cleanup
				cleanupRecording();

				resolve(blob);
			};

			mediaRecorder.stop();
		});
	}

	/**
	 * Pause recording
	 */
	function pauseRecording(): void {
		if (!isRecording.value || isPaused.value || !mediaRecorder) return;

		mediaRecorder.pause();
		isPaused.value = true;

		// Pause level monitoring
		if (levelTimer) {
			cancelAnimationFrame(levelTimer);
			levelTimer = null;
		}
	}

	/**
	 * Resume recording
	 */
	function resumeRecording(): void {
		if (!isRecording.value || !isPaused.value || !mediaRecorder) return;

		mediaRecorder.resume();
		isPaused.value = false;

		// Resume level monitoring
		if (mediaStream) {
			startLevelMonitoring(mediaStream);
		}
	}

	/**
	 * Cancel recording and discard data
	 */
	function cancelRecording(): void {
		if (mediaRecorder && isRecording.value) {
			mediaRecorder.stop();
		}
		recordedChunks.length = 0;
		audioBlob.value = null;
		cleanupRecording();
		duration.value = 0;
	}

	/**
	 * Cleanup recording resources
	 */
	function cleanupRecording(): void {
		isRecording.value = false;
		isPaused.value = false;

		// Stop duration timer
		if (durationTimer) {
			clearInterval(durationTimer);
			durationTimer = null;
		}

		// Stop level monitoring
		stopLevelMonitoring();

		// Release media stream
		if (mediaStream) {
			for (const track of mediaStream.getTracks()) {
                track.stop();
            }
			mediaStream = null;
		}

		mediaRecorder = null;
	}

	/**
	 * Reset all state
	 */
	function reset(): void {
		cancelRecording();
		audioBlob.value = null;
		error.value = null;
		duration.value = 0;
	}

	/**
	 * Get recorded audio as WAV blob
	 */
	async function getWavBlob(): Promise<Blob | null> {
		if (!audioBlob.value) return null;

		try {
			return await convertToWavBlob(audioBlob.value);
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : 'Failed to convert to WAV';
			return null;
		}
	}

	/**
	 * Get recorded audio as base64 WAV string
	 */
	async function getBase64Wav(): Promise<string | null> {
		if (!audioBlob.value) return null;

		try {
			return await convertToBase64Wav(audioBlob.value);
		} catch (err) {
			error.value =
				err instanceof Error ? err.message : 'Failed to convert to base64';
			return null;
		}
	}

	// Cleanup on unmount
	onUnmounted(() => {
		cleanupRecording();
	});

	return {
		isRecording,
		isPaused,
		duration,
		audioBlob,
		error,
		hasPermission,
		meetsMinDuration,
		audioLevel,
		requestPermission,
		startRecording,
		stopRecording,
		pauseRecording,
		resumeRecording,
		cancelRecording,
		reset,
		getWavBlob,
		getBase64Wav,
	};
}
