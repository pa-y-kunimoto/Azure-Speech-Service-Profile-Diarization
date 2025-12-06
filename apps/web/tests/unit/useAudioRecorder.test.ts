/**
 * Unit tests for useAudioRecorder composable
 * TDD: Write tests first, verify behavior
 *
 * Tests MediaRecorder integration for browser audio recording
 * with WAV conversion support (16kHz, 16-bit, Mono)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock MediaRecorder
const mockStart = vi.fn();
const mockStop = vi.fn();
const mockPause = vi.fn();
const mockResume = vi.fn();

class MockMediaRecorder {
	state: 'inactive' | 'recording' | 'paused' = 'inactive';
	ondataavailable: ((event: { data: Blob }) => void) | null = null;
	onstop: (() => void) | null = null;
	onerror: ((event: { error: Error }) => void) | null = null;

	constructor(
		public stream: MediaStream,
		public options?: MediaRecorderOptions
	) {}

	start(timeslice?: number) {
		mockStart(timeslice);
		this.state = 'recording';
	}

	stop() {
		mockStop();
		this.state = 'inactive';
		// Simulate data available event
		if (this.ondataavailable) {
			const audioBlob = new Blob(['mock audio data'], { type: 'audio/webm' });
			this.ondataavailable({ data: audioBlob });
		}
		if (this.onstop) {
			this.onstop();
		}
	}

	pause() {
		mockPause();
		this.state = 'paused';
	}

	resume() {
		mockResume();
		this.state = 'recording';
	}

	static isTypeSupported(mimeType: string): boolean {
		return mimeType === 'audio/webm' || mimeType === 'audio/webm;codecs=opus';
	}
}

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();
const mockMediaStream = {
	getTracks: () => [{ stop: vi.fn() }],
};

// Setup global mocks
vi.stubGlobal('MediaRecorder', MockMediaRecorder);
vi.stubGlobal('navigator', {
	mediaDevices: {
		getUserMedia: mockGetUserMedia,
	},
});

// Mock AudioContext for duration calculation
const mockAudioContext = {
	decodeAudioData: vi.fn(),
	close: vi.fn().mockResolvedValue(undefined),
	createAnalyser: vi.fn(() => ({
		fftSize: 256,
		frequencyBinCount: 128,
		getByteFrequencyData: vi.fn(),
	})),
	createMediaStreamSource: vi.fn(() => ({
		connect: vi.fn(),
	})),
};
vi.stubGlobal(
	'AudioContext',
	vi.fn(() => mockAudioContext)
);

// Mock wavEncoder
vi.mock('~/utils/wavEncoder', () => ({
	encodeWav: vi.fn().mockResolvedValue(new ArrayBuffer(1000)),
	convertToWavBlob: vi.fn().mockResolvedValue(new Blob(['wav data'], { type: 'audio/wav' })),
	convertToBase64Wav: vi.fn().mockResolvedValue('bW9ja2Jhc2U2NGRhdGE='),
}));

// Dynamic import to apply mocks first
const { useAudioRecorder } = await import('~/composables/useAudioRecorder');

describe('useAudioRecorder', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetUserMedia.mockResolvedValue(mockMediaStream);
		mockAudioContext.decodeAudioData.mockResolvedValue({
			duration: 10,
			numberOfChannels: 1,
			sampleRate: 48000,
			length: 480000,
			getChannelData: () => new Float32Array(480000),
		});
	});

	describe('initial state', () => {
		it('should return initial state with isRecording as false', () => {
			const recorder = useAudioRecorder();

			expect(recorder.isRecording.value).toBe(false);
			expect(recorder.isPaused.value).toBe(false);
			expect(recorder.duration.value).toBe(0);
			expect(recorder.audioBlob.value).toBeNull();
			expect(recorder.error.value).toBeNull();
		});

		it('should have permission as null initially', () => {
			const recorder = useAudioRecorder();

			expect(recorder.hasPermission.value).toBeNull();
		});
	});

	describe('requestPermission', () => {
		it('should request microphone permission successfully', async () => {
			const recorder = useAudioRecorder();

			const result = await recorder.requestPermission();

			expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
			expect(result).toBe(true);
			expect(recorder.hasPermission.value).toBe(true);
		});

		it('should handle permission denied', async () => {
			mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
			const recorder = useAudioRecorder();

			const result = await recorder.requestPermission();

			expect(result).toBe(false);
			expect(recorder.hasPermission.value).toBe(false);
			expect(recorder.error.value).toContain('Permission denied');
		});

		it('should release tracks after permission check', async () => {
			const mockTrack = { stop: vi.fn() };
			mockGetUserMedia.mockResolvedValue({
				getTracks: () => [mockTrack],
			});
			const recorder = useAudioRecorder();

			await recorder.requestPermission();

			expect(mockTrack.stop).toHaveBeenCalled();
		});
	});

	describe('startRecording', () => {
		it('should start recording successfully', async () => {
			const recorder = useAudioRecorder();

			await recorder.startRecording();

			expect(mockGetUserMedia).toHaveBeenCalledWith({
				audio: {
					channelCount: 1,
					sampleRate: 16000,
					echoCancellation: true,
					noiseSuppression: true,
				},
			});
			expect(mockStart).toHaveBeenCalled();
			expect(recorder.isRecording.value).toBe(true);
		});

		it('should update duration while recording', async () => {
			vi.useFakeTimers();
			const recorder = useAudioRecorder();

			await recorder.startRecording();
			expect(recorder.duration.value).toBe(0);

			// Advance time by 1 second
			await vi.advanceTimersByTimeAsync(1000);
			expect(recorder.duration.value).toBe(1);

			// Advance time by another 2 seconds
			await vi.advanceTimersByTimeAsync(2000);
			expect(recorder.duration.value).toBe(3);

			vi.useRealTimers();
		});

		it('should handle getUserMedia error', async () => {
			mockGetUserMedia.mockRejectedValue(new Error('No microphone found'));
			const recorder = useAudioRecorder();

			await recorder.startRecording();

			expect(recorder.isRecording.value).toBe(false);
			expect(recorder.error.value).toContain('No microphone found');
		});

		it('should not start if already recording', async () => {
			const recorder = useAudioRecorder();

			await recorder.startRecording();
			mockGetUserMedia.mockClear();
			mockStart.mockClear();

			await recorder.startRecording();

			expect(mockGetUserMedia).not.toHaveBeenCalled();
			expect(mockStart).not.toHaveBeenCalled();
		});
	});

	describe('stopRecording', () => {
		it('should stop recording and return audio blob', async () => {
			const recorder = useAudioRecorder();

			await recorder.startRecording();
			const blob = await recorder.stopRecording();

			expect(mockStop).toHaveBeenCalled();
			expect(recorder.isRecording.value).toBe(false);
			expect(blob).toBeInstanceOf(Blob);
			expect(recorder.audioBlob.value).toBeInstanceOf(Blob);
		});

		it('should stop duration timer when recording stops', async () => {
			vi.useFakeTimers();
			const recorder = useAudioRecorder();

			await recorder.startRecording();
			await vi.advanceTimersByTimeAsync(3000);
			expect(recorder.duration.value).toBe(3);

			await recorder.stopRecording();
			await vi.advanceTimersByTimeAsync(2000);

			// Duration should not increase after stopping
			expect(recorder.duration.value).toBe(3);

			vi.useRealTimers();
		});

		it('should return null if not recording', async () => {
			const recorder = useAudioRecorder();

			const blob = await recorder.stopRecording();

			expect(blob).toBeNull();
			expect(mockStop).not.toHaveBeenCalled();
		});

		it('should release media stream tracks', async () => {
			const mockTrack = { stop: vi.fn() };
			mockGetUserMedia.mockResolvedValue({
				getTracks: () => [mockTrack],
			});
			const recorder = useAudioRecorder();

			await recorder.startRecording();
			await recorder.stopRecording();

			expect(mockTrack.stop).toHaveBeenCalled();
		});
	});

	describe('pauseRecording', () => {
		it('should pause recording', async () => {
			const recorder = useAudioRecorder();

			await recorder.startRecording();
			recorder.pauseRecording();

			expect(mockPause).toHaveBeenCalled();
			expect(recorder.isPaused.value).toBe(true);
			expect(recorder.isRecording.value).toBe(true); // Still "recording" but paused
		});

		it('should not pause if not recording', () => {
			const recorder = useAudioRecorder();

			recorder.pauseRecording();

			expect(mockPause).not.toHaveBeenCalled();
		});

		it('should pause duration timer', async () => {
			vi.useFakeTimers();
			const recorder = useAudioRecorder();

			await recorder.startRecording();
			await vi.advanceTimersByTimeAsync(2000);
			expect(recorder.duration.value).toBe(2);

			recorder.pauseRecording();
			await vi.advanceTimersByTimeAsync(3000);

			// Duration should not increase while paused
			expect(recorder.duration.value).toBe(2);

			vi.useRealTimers();
		});
	});

	describe('resumeRecording', () => {
		it('should resume recording', async () => {
			const recorder = useAudioRecorder();

			await recorder.startRecording();
			recorder.pauseRecording();
			recorder.resumeRecording();

			expect(mockResume).toHaveBeenCalled();
			expect(recorder.isPaused.value).toBe(false);
		});

		it('should resume duration timer', async () => {
			vi.useFakeTimers();
			const recorder = useAudioRecorder();

			await recorder.startRecording();
			await vi.advanceTimersByTimeAsync(2000);
			recorder.pauseRecording();
			await vi.advanceTimersByTimeAsync(3000);
			expect(recorder.duration.value).toBe(2);

			recorder.resumeRecording();
			await vi.advanceTimersByTimeAsync(2000);

			expect(recorder.duration.value).toBe(4);

			vi.useRealTimers();
		});

		it('should not resume if not paused', async () => {
			const recorder = useAudioRecorder();

			await recorder.startRecording();
			recorder.resumeRecording();

			expect(mockResume).not.toHaveBeenCalled();
		});
	});

	describe('cancelRecording', () => {
		it('should cancel recording and discard data', async () => {
			const recorder = useAudioRecorder();

			await recorder.startRecording();
			recorder.cancelRecording();

			expect(recorder.isRecording.value).toBe(false);
			expect(recorder.audioBlob.value).toBeNull();
			expect(recorder.duration.value).toBe(0);
		});

		it('should release media stream tracks on cancel', async () => {
			const mockTrack = { stop: vi.fn() };
			mockGetUserMedia.mockResolvedValue({
				getTracks: () => [mockTrack],
			});
			const recorder = useAudioRecorder();

			await recorder.startRecording();
			recorder.cancelRecording();

			expect(mockTrack.stop).toHaveBeenCalled();
		});
	});

	describe('reset', () => {
		it('should reset all state', async () => {
			const recorder = useAudioRecorder();

			await recorder.startRecording();
			await recorder.stopRecording();

			recorder.reset();

			expect(recorder.isRecording.value).toBe(false);
			expect(recorder.isPaused.value).toBe(false);
			expect(recorder.duration.value).toBe(0);
			expect(recorder.audioBlob.value).toBeNull();
			expect(recorder.error.value).toBeNull();
		});
	});

	describe('getWavBlob', () => {
		it('should convert recorded audio to WAV format', async () => {
			const recorder = useAudioRecorder();

			await recorder.startRecording();
			await recorder.stopRecording();

			const wavBlob = await recorder.getWavBlob();

			expect(wavBlob).toBeInstanceOf(Blob);
			expect(wavBlob?.type).toBe('audio/wav');
		});

		it('should return null if no audio recorded', async () => {
			const recorder = useAudioRecorder();

			const wavBlob = await recorder.getWavBlob();

			expect(wavBlob).toBeNull();
		});
	});

	describe('getBase64Wav', () => {
		it('should convert recorded audio to base64 WAV', async () => {
			const recorder = useAudioRecorder();

			await recorder.startRecording();
			await recorder.stopRecording();

			const base64 = await recorder.getBase64Wav();

			expect(base64).toBeDefined();
			expect(typeof base64).toBe('string');
		});

		it('should return null if no audio recorded', async () => {
			const recorder = useAudioRecorder();

			const base64 = await recorder.getBase64Wav();

			expect(base64).toBeNull();
		});
	});

	describe('minimum duration validation', () => {
		it('should indicate if recording meets minimum duration', async () => {
			vi.useFakeTimers();
			const recorder = useAudioRecorder({ minDuration: 5 });

			await recorder.startRecording();
			await vi.advanceTimersByTimeAsync(3000);

			expect(recorder.meetsMinDuration.value).toBe(false);

			await vi.advanceTimersByTimeAsync(3000);
			expect(recorder.meetsMinDuration.value).toBe(true);

			vi.useRealTimers();
		});

		it('should use default minimum duration of 5 seconds', async () => {
			vi.useFakeTimers();
			const recorder = useAudioRecorder();

			await recorder.startRecording();
			await vi.advanceTimersByTimeAsync(4000);
			expect(recorder.meetsMinDuration.value).toBe(false);

			await vi.advanceTimersByTimeAsync(1000);
			expect(recorder.meetsMinDuration.value).toBe(true);

			vi.useRealTimers();
		});
	});

	describe('audio level monitoring', () => {
		it('should provide audio level for visualization', async () => {
			const recorder = useAudioRecorder();

			await recorder.startRecording();

			// audioLevel should be a reactive value between 0 and 1
			expect(recorder.audioLevel.value).toBeGreaterThanOrEqual(0);
			expect(recorder.audioLevel.value).toBeLessThanOrEqual(1);
		});
	});
});
