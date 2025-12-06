/**
 * WAV Encoder Utility
 *
 * Encodes audio data to WAV format with Azure Speech Service requirements:
 * - Sample Rate: 16kHz
 * - Bit Depth: 16-bit
 * - Channels: Mono
 */

export interface WavEncoderOptions {
	sampleRate?: number;
	numChannels?: number;
	bitDepth?: number;
}

const DEFAULT_OPTIONS: Required<WavEncoderOptions> = {
	sampleRate: 16000,
	numChannels: 1,
	bitDepth: 16,
};

/**
 * Encode Float32Array audio data to WAV ArrayBuffer
 *
 * @param samples - Audio samples as Float32Array (values between -1 and 1)
 * @param options - Encoding options
 * @returns WAV file as ArrayBuffer
 */
export function encodeWav(samples: Float32Array, options: WavEncoderOptions = {}): ArrayBuffer {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const { sampleRate, numChannels, bitDepth } = opts;

	const bytesPerSample = bitDepth / 8;
	const blockAlign = numChannels * bytesPerSample;
	const byteRate = sampleRate * blockAlign;
	const dataSize = samples.length * bytesPerSample;

	// WAV file structure:
	// RIFF header (12 bytes) + fmt chunk (24 bytes) + data chunk header (8 bytes) + data
	const buffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer);

	// RIFF chunk descriptor
	writeString(view, 0, 'RIFF');
	view.setUint32(4, 36 + dataSize, true); // File size - 8
	writeString(view, 8, 'WAVE');

	// fmt sub-chunk
	writeString(view, 12, 'fmt ');
	view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
	view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, byteRate, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, bitDepth, true);

	// data sub-chunk
	writeString(view, 36, 'data');
	view.setUint32(40, dataSize, true);

	// Write audio samples
	const offset = 44;
	if (bitDepth === 16) {
		for (let i = 0; i < samples.length; i++) {
			// Clamp and convert to 16-bit signed integer
			const sampleValue = samples[i] ?? 0;
			const sample = Math.max(-1, Math.min(1, sampleValue));
			const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
			view.setInt16(offset + i * 2, intSample, true);
		}
	} else if (bitDepth === 8) {
		for (let i = 0; i < samples.length; i++) {
			const sampleValue = samples[i] ?? 0;
			const sample = Math.max(-1, Math.min(1, sampleValue));
			// 8-bit WAV is unsigned
			const intSample = ((sample + 1) / 2) * 255;
			view.setUint8(offset + i, intSample);
		}
	}

	return buffer;
}

/**
 * Helper function to write a string to a DataView
 */
function writeString(view: DataView, offset: number, str: string): void {
	for (let i = 0; i < str.length; i++) {
		view.setUint8(offset + i, str.charCodeAt(i));
	}
}

/**
 * Convert ArrayBuffer to WAV Blob
 */
export function createWavBlob(buffer: ArrayBuffer): Blob {
	return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Resample audio data to target sample rate
 *
 * @param samples - Original audio samples
 * @param originalSampleRate - Original sample rate
 * @param targetSampleRate - Target sample rate (default: 16000)
 * @returns Resampled audio samples
 */
export function resample(
	samples: Float32Array,
	originalSampleRate: number,
	targetSampleRate = 16000
): Float32Array {
	if (originalSampleRate === targetSampleRate) {
		return samples;
	}

	const ratio = originalSampleRate / targetSampleRate;
	const newLength = Math.round(samples.length / ratio);
	const result = new Float32Array(newLength);

	// Linear interpolation resampling
	for (let i = 0; i < newLength; i++) {
		const srcIndex = i * ratio;
		const srcIndexFloor = Math.floor(srcIndex);
		const srcIndexCeil = Math.min(srcIndexFloor + 1, samples.length - 1);
		const t = srcIndex - srcIndexFloor;

		const floorValue = samples[srcIndexFloor] ?? 0;
		const ceilValue = samples[srcIndexCeil] ?? 0;
		result[i] = floorValue * (1 - t) + ceilValue * t;
	}

	return result;
}

/**
 * Convert stereo audio to mono by averaging channels
 *
 * @param leftChannel - Left channel samples
 * @param rightChannel - Right channel samples
 * @returns Mono audio samples
 */
export function stereoToMono(leftChannel: Float32Array, rightChannel: Float32Array): Float32Array {
	const length = Math.min(leftChannel.length, rightChannel.length);
	const mono = new Float32Array(length);

	for (let i = 0; i < length; i++) {
		const leftValue = leftChannel[i] ?? 0;
		const rightValue = rightChannel[i] ?? 0;
		mono[i] = (leftValue + rightValue) / 2;
	}

	return mono;
}

/**
 * Convert audio blob to WAV format with Azure Speech requirements
 *
 * @param audioBlob - Input audio blob (any format supported by AudioContext)
 * @returns WAV blob with 16kHz, 16-bit, Mono
 */
export async function convertToWavBlob(audioBlob: Blob): Promise<Blob> {
	const arrayBuffer = await audioBlob.arrayBuffer();
	const audioContext = new AudioContext();

	try {
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

		// Get audio data
		let samples: Float32Array;

		if (audioBuffer.numberOfChannels === 2) {
			// Convert stereo to mono
			const left = audioBuffer.getChannelData(0);
			const right = audioBuffer.getChannelData(1);
			samples = stereoToMono(left, right);
		} else {
			samples = audioBuffer.getChannelData(0);
		}

		// Resample to 16kHz
		const resampled = resample(samples, audioBuffer.sampleRate, 16000);

		// Encode to WAV
		const wavBuffer = encodeWav(resampled, {
			sampleRate: 16000,
			numChannels: 1,
			bitDepth: 16,
		});

		return createWavBlob(wavBuffer);
	} finally {
		await audioContext.close();
	}
}

/**
 * Convert audio blob to base64 encoded WAV string
 *
 * @param audioBlob - Input audio blob
 * @returns Base64 encoded WAV data
 */
export async function convertToBase64Wav(audioBlob: Blob): Promise<string> {
	const wavBlob = await convertToWavBlob(audioBlob);
	const arrayBuffer = await wavBlob.arrayBuffer();
	const bytes = new Uint8Array(arrayBuffer);

	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i] ?? 0);
	}

	return btoa(binary);
}

/**
 * Calculate the duration in seconds from a WAV blob
 */
export async function getWavDuration(wavBlob: Blob): Promise<number> {
	const arrayBuffer = await wavBlob.arrayBuffer();
	const view = new DataView(arrayBuffer);

	// Read sample rate from WAV header (offset 24)
	const sampleRate = view.getUint32(24, true);
	// Read data size from WAV header (offset 40)
	const dataSize = view.getUint32(40, true);
	// Read bits per sample (offset 34)
	const bitsPerSample = view.getUint16(34, true);
	// Read number of channels (offset 22)
	const numChannels = view.getUint16(22, true);

	const bytesPerSample = bitsPerSample / 8;
	const numSamples = dataSize / (bytesPerSample * numChannels);

	return numSamples / sampleRate;
}
