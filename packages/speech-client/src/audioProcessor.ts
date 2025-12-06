/**
 * AudioProcessor class for managing audio streaming to Azure Speech Service
 *
 * Provides:
 * - PushStream management for real-time audio
 * - Audio format validation and conversion
 * - Buffer management for chunked audio data
 */

import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

export interface AudioProcessorConfig {
	sampleRate?: number;
	bitsPerSample?: number;
	channels?: number;
}

const DEFAULT_CONFIG: Required<AudioProcessorConfig> = {
	sampleRate: 16000,
	bitsPerSample: 16,
	channels: 1,
};

/**
 * Audio format specification for Azure Speech Service
 */
export interface AudioFormat {
	sampleRate: number;
	bitsPerSample: number;
	channels: number;
}

/**
 * Audio processor for streaming audio to Azure Speech Service
 */
export class AudioProcessor {
	private config: Required<AudioProcessorConfig>;
	private pushStream: SpeechSDK.PushAudioInputStream | null = null;
	private audioConfig: SpeechSDK.AudioConfig | null = null;
	private isActive = false;
	private bytesProcessed = 0;

	constructor(config: AudioProcessorConfig = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Get the required audio format
	 */
	getRequiredFormat(): AudioFormat {
		return {
			sampleRate: this.config.sampleRate,
			bitsPerSample: this.config.bitsPerSample,
			channels: this.config.channels,
		};
	}

	/**
	 * Validate audio format against requirements
	 */
	validateFormat(format: AudioFormat): boolean {
		return (
			format.sampleRate === this.config.sampleRate &&
			format.bitsPerSample === this.config.bitsPerSample &&
			format.channels === this.config.channels
		);
	}

	/**
	 * Initialize the push stream for audio processing
	 */
	initialize(): SpeechSDK.AudioConfig {
		if (this.pushStream) {
			this.close();
		}

		// Create audio format
		const format = SpeechSDK.AudioStreamFormat.getWaveFormatPCM(
			this.config.sampleRate,
			this.config.bitsPerSample,
			this.config.channels
		);

		// Create push stream
		this.pushStream = SpeechSDK.AudioInputStream.createPushStream(format);

		// Create audio config from push stream
		this.audioConfig = SpeechSDK.AudioConfig.fromStreamInput(this.pushStream);

		this.isActive = true;
		this.bytesProcessed = 0;

		return this.audioConfig;
	}

	/**
	 * Get the audio config for use with transcriber
	 */
	getAudioConfig(): SpeechSDK.AudioConfig | null {
		return this.audioConfig;
	}

	/**
	 * Push audio data to the stream
	 */
	pushAudio(audioData: ArrayBuffer | Uint8Array): void {
		if (!this.pushStream || !this.isActive) {
			throw new Error('AudioProcessor is not initialized or has been closed');
		}

		const data: ArrayBuffer =
			audioData instanceof Uint8Array ? toArrayBuffer(audioData) : audioData;
		this.pushStream.write(data);
		this.bytesProcessed += data.byteLength;
	}

	/**
	 * Push audio data from Float32Array (Web Audio API format)
	 * Converts to 16-bit PCM
	 */
	pushFloat32Audio(samples: Float32Array): void {
		const pcmData = this.float32ToPcm16(samples);
		this.pushAudio(pcmData);
	}

	/**
	 * Convert Float32Array samples to 16-bit PCM
	 */
	private float32ToPcm16(samples: Float32Array): Uint8Array {
		const buffer = new ArrayBuffer(samples.length * 2);
		const view = new DataView(buffer);

		for (let i = 0; i < samples.length; i++) {
			// Clamp to -1 to 1 range
			const sample = Math.max(-1, Math.min(1, samples[i] ?? 0));
			// Convert to 16-bit integer
			const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
			view.setInt16(i * 2, int16, true);
		}

		return new Uint8Array(buffer);
	}

	/**
	 * Get number of bytes processed
	 */
	getBytesProcessed(): number {
		return this.bytesProcessed;
	}

	/**
	 * Get estimated duration in seconds based on bytes processed
	 */
	getEstimatedDurationSeconds(): number {
		const bytesPerSecond =
			this.config.sampleRate * (this.config.bitsPerSample / 8) * this.config.channels;
		return this.bytesProcessed / bytesPerSecond;
	}

	/**
	 * Check if the processor is active
	 */
	isProcessing(): boolean {
		return this.isActive;
	}

	/**
	 * Close the push stream
	 */
	close(): void {
		if (this.pushStream) {
			this.pushStream.close();
			this.pushStream = null;
		}
		this.audioConfig = null;
		this.isActive = false;
	}

	/**
	 * Create audio config from a WAV buffer (for file-based audio)
	 */
	static fromWavBuffer(buffer: Buffer | ArrayBuffer): SpeechSDK.AudioConfig {
		const buf = buffer instanceof Buffer ? buffer : Buffer.from(new Uint8Array(buffer));
		return SpeechSDK.AudioConfig.fromWavFileInput(buf);
	}
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
	const buffer = new ArrayBuffer(u8.byteLength);
	new Uint8Array(buffer).set(u8);
	return buffer;
}
