/**
 * Audio file conversion utilities
 * Converts audio files to WAV format (16kHz, 16-bit, Mono) for Azure Speech Service
 */

/**
 * Audio format specification for Azure Speech Service
 */
export const AZURE_AUDIO_FORMAT = {
	sampleRate: 16000,
	bitsPerSample: 16,
	channels: 1,
} as const;

/**
 * Supported input audio formats
 */
export const SUPPORTED_FORMATS = [
	'audio/wav',
	'audio/wave',
	'audio/x-wav',
	'audio/mpeg',
	'audio/mp3',
] as const;

/**
 * Result of audio conversion
 */
export interface AudioConversionResult {
	success: boolean;
	audioBase64?: string;
	durationSeconds?: number;
	error?: string;
}

/**
 * Check if a MIME type is supported
 */
export function isSupportedFormat(mimeType: string): boolean {
	return SUPPORTED_FORMATS.includes(mimeType as (typeof SUPPORTED_FORMATS)[number]);
}

/**
 * Convert audio file to Base64 WAV format
 * Handles MP3 to WAV conversion and normalizes to 16kHz/16-bit/Mono
 */
export async function convertAudioToBase64Wav(file: File): Promise<AudioConversionResult> {
	try {
		// Check file type
		if (!isSupportedFormat(file.type)) {
			return {
				success: false,
				error: `Unsupported audio format: ${file.type}. Supported formats: WAV, MP3`,
			};
		}

		// Create audio context for decoding
		const audioContext = new AudioContext({ sampleRate: AZURE_AUDIO_FORMAT.sampleRate });

		// Read file as ArrayBuffer
		const arrayBuffer = await file.arrayBuffer();

		// Decode audio data
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

		// Get audio duration
		const durationSeconds = audioBuffer.duration;

		// Check minimum duration
		if (durationSeconds < 5) {
			await audioContext.close();
			return {
				success: false,
				error: `Audio duration (${durationSeconds.toFixed(1)}s) is less than the required minimum of 5 seconds`,
			};
		}

		// Convert to mono if stereo
		const monoBuffer = convertToMono(audioBuffer, audioContext);

		// Resample to target sample rate if needed
		const resampledBuffer = await resampleAudio(
			monoBuffer,
			audioContext,
			AZURE_AUDIO_FORMAT.sampleRate
		);

		// Encode as WAV
		const wavArrayBuffer = encodeWav(resampledBuffer);

		// Convert to Base64
		const base64 = arrayBufferToBase64(wavArrayBuffer);

		await audioContext.close();

		return {
			success: true,
			audioBase64: base64,
			durationSeconds,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error during audio conversion',
		};
	}
}

/**
 * Convert stereo audio to mono by averaging channels
 */
function convertToMono(audioBuffer: AudioBuffer, audioContext: AudioContext): AudioBuffer {
	if (audioBuffer.numberOfChannels === 1) {
		return audioBuffer;
	}

	const monoBuffer = audioContext.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);

	const monoData = monoBuffer.getChannelData(0);
	const channels: Float32Array[] = [];

	for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
		channels.push(audioBuffer.getChannelData(i));
	}

	// Average all channels
	for (let i = 0; i < audioBuffer.length; i++) {
		let sum = 0;
		for (const channel of channels) {
			sum += channel[i] ?? 0;
		}
		monoData[i] = sum / audioBuffer.numberOfChannels;
	}

	return monoBuffer;
}

/**
 * Resample audio to target sample rate using OfflineAudioContext
 */
async function resampleAudio(
	audioBuffer: AudioBuffer,
	_audioContext: AudioContext,
	targetSampleRate: number
): Promise<AudioBuffer> {
	if (audioBuffer.sampleRate === targetSampleRate) {
		return audioBuffer;
	}

	// Calculate new length based on sample rate ratio
	const ratio = targetSampleRate / audioBuffer.sampleRate;
	const newLength = Math.round(audioBuffer.length * ratio);

	// Create offline context for resampling
	const offlineContext = new OfflineAudioContext(1, newLength, targetSampleRate);

	// Create buffer source
	const source = offlineContext.createBufferSource();
	source.buffer = audioBuffer;
	source.connect(offlineContext.destination);
	source.start(0);

	// Render resampled audio
	const resampledBuffer = await offlineContext.startRendering();
	return resampledBuffer;
}

/**
 * Encode AudioBuffer to WAV format
 */
function encodeWav(audioBuffer: AudioBuffer): ArrayBuffer {
	const numChannels = audioBuffer.numberOfChannels;
	const sampleRate = audioBuffer.sampleRate;
	const bitsPerSample = AZURE_AUDIO_FORMAT.bitsPerSample;
	const bytesPerSample = bitsPerSample / 8;
	const blockAlign = numChannels * bytesPerSample;
	const dataLength = audioBuffer.length * blockAlign;
	const buffer = new ArrayBuffer(44 + dataLength);
	const view = new DataView(buffer);

	// Write WAV header
	// "RIFF" chunk descriptor
	writeString(view, 0, 'RIFF');
	view.setUint32(4, 36 + dataLength, true);
	writeString(view, 8, 'WAVE');

	// "fmt " sub-chunk
	writeString(view, 12, 'fmt ');
	view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
	view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, bitsPerSample, true);

	// "data" sub-chunk
	writeString(view, 36, 'data');
	view.setUint32(40, dataLength, true);

	// Write audio data
	const channelData = audioBuffer.getChannelData(0);
	let offset = 44;

	for (let i = 0; i < audioBuffer.length; i++) {
		// Convert float [-1, 1] to 16-bit integer
		const sample = Math.max(-1, Math.min(1, channelData[i] ?? 0));
		const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
		view.setInt16(offset, intSample, true);
		offset += bytesPerSample;
	}

	return buffer;
}

/**
 * Write string to DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
	for (let i = 0; i < string.length; i++) {
		view.setUint8(offset + i, string.charCodeAt(i));
	}
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i] ?? 0);
	}
	return btoa(binary);
}

/**
 * Get audio duration from a file without full conversion
 */
export async function getAudioDuration(file: File): Promise<number> {
	return new Promise((resolve, reject) => {
		const audio = new Audio();
		audio.preload = 'metadata';

		audio.onloadedmetadata = () => {
			resolve(audio.duration);
			URL.revokeObjectURL(audio.src);
		};

		audio.onerror = () => {
			reject(new Error('Failed to load audio metadata'));
			URL.revokeObjectURL(audio.src);
		};

		audio.src = URL.createObjectURL(file);
	});
}
