// Azure Speech Service client exports
export { DiarizationClient } from './diarizationClient.js';
export type {
	DiarizationClientConfig,
	AudioFormat,
	EnrollmentResult,
	LocalVoiceProfile,
} from './diarizationClient.js';

export { AudioProcessor } from './audioProcessor.js';
export type { AudioProcessorConfig, AudioFormat as ProcessorAudioFormat } from './audioProcessor.js';
