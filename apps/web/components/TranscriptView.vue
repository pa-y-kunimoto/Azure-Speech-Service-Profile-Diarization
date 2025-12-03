<script setup lang="ts">
/**
 * TranscriptView Component
 *
 * Displays real-time transcription with speaker identification.
 * Shows utterances with speaker badges, timestamps, and confidence scores.
 */

import { ref, watch } from 'vue';

/**
 * Utterance data structure
 */
interface Utterance {
	id: string;
	sessionId?: string;
	azureSpeakerId?: string;
	speakerId?: string;
	speakerName: string;
	text: string;
	startOffsetSeconds?: number;
	endOffsetSeconds?: number;
	durationSeconds?: number;
	confidence: number;
	recognizedAt?: string;
	timestamp?: string;
	offsetMs?: number;
	isFinal?: boolean;
	/** True if this utterance was extracted from an enrollment audio profile */
	isEnrollment?: boolean;
	/** Profile name if this is an enrollment utterance */
	enrollmentProfileName?: string;
}

const props = withDefaults(
	defineProps<{
		utterances: Utterance[];
		interimText?: string;
		interimSpeaker?: string;
		isActive?: boolean;
		autoScroll?: boolean;
	}>(),
	{
		utterances: () => [],
		interimText: '',
		interimSpeaker: '',
		isActive: false,
		autoScroll: true,
	}
);

const emit = defineEmits<{
	speakerClick: [speakerId: string, speakerName: string];
}>();

const containerRef = ref<HTMLElement | null>(null);

// Auto-scroll to bottom when new utterances are added
watch(
	() => props.utterances.length,
	() => {
		if (props.autoScroll && containerRef.value) {
			setTimeout(() => {
				containerRef.value?.scrollTo({
					top: containerRef.value.scrollHeight,
					behavior: 'smooth',
				});
			}, 100);
		}
	}
);

/**
 * Format seconds to mm:ss
 */
function formatTime(seconds: number | undefined): string {
	if (seconds === undefined) return '00:00';
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format confidence score to percentage
 */
function formatConfidence(confidence: number): string {
	return `${Math.round(confidence * 100)}%`;
}

/**
 * Get consistent color for speaker based on name
 */
function getSpeakerColor(speakerName: string): string {
	const colors = [
		'bg-blue-100 text-blue-800',
		'bg-green-100 text-green-800',
		'bg-purple-100 text-purple-800',
		'bg-orange-100 text-orange-800',
		'bg-pink-100 text-pink-800',
		'bg-cyan-100 text-cyan-800',
		'bg-amber-100 text-amber-800',
		'bg-indigo-100 text-indigo-800',
	];
	const hash = speakerName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
	return colors[hash % colors.length] ?? colors[0] ?? 'bg-gray-100 text-gray-800';
}

/**
 * Handle speaker badge click
 */
function handleSpeakerClick(utterance: Utterance): void {
	const speakerId = utterance.azureSpeakerId || utterance.speakerId || 'unknown';
	emit('speakerClick', speakerId, utterance.speakerName);
}

/**
 * Get start offset in seconds
 */
function getStartOffset(utterance: Utterance): number {
	if (utterance.startOffsetSeconds !== undefined) {
		return utterance.startOffsetSeconds;
	}
	if (utterance.offsetMs !== undefined) {
		return utterance.offsetMs / 1000;
	}
	return 0;
}

/**
 * Get end offset in seconds
 */
function getEndOffset(utterance: Utterance): number {
	if (utterance.endOffsetSeconds !== undefined) {
		return utterance.endOffsetSeconds;
	}
	if (utterance.offsetMs !== undefined && utterance.durationSeconds !== undefined) {
		return utterance.offsetMs / 1000 + utterance.durationSeconds;
	}
	return getStartOffset(utterance) + 2;
}
</script>

<template>
	<div
		ref="containerRef"
		class="transcript-view border rounded-lg overflow-hidden bg-white max-h-96 overflow-y-auto"
		data-testid="transcript-view"
	>
		<!-- Active Indicator -->
		<div
			v-if="isActive"
			class="active-indicator flex items-center gap-2 p-2 bg-green-50 border-b sticky top-0"
			data-testid="active-indicator"
		>
			<span class="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
			<span class="text-sm text-green-700">認識中...</span>
		</div>

		<!-- Empty State -->
		<div
			v-if="utterances.length === 0 && !interimText"
			class="empty-state text-center py-8 text-gray-500"
			data-testid="empty-state"
		>
			<p class="text-lg">発話がありません</p>
			<p v-if="isActive" class="text-sm mt-2">マイクに向かって話してください</p>
			<p v-else class="text-sm mt-2">認識を開始してください</p>
		</div>

		<!-- Utterances List -->
		<div
			v-for="utterance in utterances"
			:key="utterance.id"
			class="utterance-item p-3 border-b last:border-b-0 transition-colors"
			:class="utterance.isEnrollment ? 'bg-purple-50 hover:bg-purple-100' : 'hover:bg-gray-50'"
			:data-testid="`utterance-${utterance.id}`"
		>
			<div class="flex items-center justify-between mb-1">
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="speaker-badge px-2 py-1 rounded text-sm font-medium transition-opacity hover:opacity-80"
						:class="getSpeakerColor(utterance.speakerName)"
						:data-testid="`speaker-${utterance.azureSpeakerId || utterance.speakerId}`"
						@click="handleSpeakerClick(utterance)"
					>
						{{ utterance.speakerName }}
					</button>
					<span
						class="text-xs text-gray-400 font-mono"
						:title="`Azure Speaker ID: ${utterance.azureSpeakerId || utterance.speakerId || 'Unknown'}`"
					>
						({{ utterance.azureSpeakerId || utterance.speakerId || 'Unknown' }})
					</span>
					<span
						v-if="utterance.isEnrollment"
						class="px-2 py-0.5 rounded text-xs font-medium bg-purple-200 text-purple-800"
					>
						🎤 {{ utterance.enrollmentProfileName || 'プロフィール音声' }}
					</span>
				</div>
				<span class="timestamp text-xs text-gray-500">
					{{ formatTime(getStartOffset(utterance)) }} - {{ formatTime(getEndOffset(utterance)) }}
				</span>
			</div>
			<p class="utterance-text mt-1" :class="utterance.isEnrollment ? 'text-purple-900' : 'text-gray-900'">{{ utterance.text }}</p>
			<span class="confidence text-xs text-gray-400 mt-1 block">
				信頼度: {{ formatConfidence(utterance.confidence) }}
			</span>
		</div>

		<!-- Interim Text -->
		<div
			v-if="interimText && isActive"
			class="interim-text p-3 bg-yellow-50 border-l-4 border-yellow-400 animate-pulse"
			data-testid="interim-text"
		>
			<span
				v-if="interimSpeaker"
				class="speaker-badge px-2 py-1 rounded text-sm font-medium bg-yellow-100 text-yellow-800 mr-2"
			>
				{{ interimSpeaker }}
			</span>
			<span class="text-gray-700 italic">{{ interimText }}</span>
		</div>
	</div>
</template>

<style scoped>
.transcript-view {
	scrollbar-width: thin;
	scrollbar-color: #d1d5db #f3f4f6;
}

.transcript-view::-webkit-scrollbar {
	width: 6px;
}

.transcript-view::-webkit-scrollbar-track {
	background: #f3f4f6;
}

.transcript-view::-webkit-scrollbar-thumb {
	background-color: #d1d5db;
	border-radius: 3px;
}
</style>
