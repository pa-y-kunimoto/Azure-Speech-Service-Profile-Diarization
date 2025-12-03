<script setup lang="ts">
/**
 * SpeakerTimeline Component (T069)
 *
 * Displays session results with utterances grouped by speaker in timeline format.
 * Shows statistics, speaker filters, visual timeline, speaker cards, and utterance list.
 */

import { computed } from 'vue';
import type { Utterance, SpeakerMapping } from '@speaker-diarization/core';

const props = withDefaults(
	defineProps<{
		utterances: Utterance[];
		speakerMappings?: SpeakerMapping[];
		sessionDurationSeconds?: number;
		selectedSpeaker?: string | null;
	}>(),
	{
		speakerMappings: () => [],
		sessionDurationSeconds: 0,
		selectedSpeaker: null,
	}
);

const emit = defineEmits<{
	speakerSelect: [speakerId: string];
	utteranceClick: [utterance: Utterance];
}>();

// Group utterances by speaker
const groupedBySpeaker = computed(() => {
	const groups: Record<
		string,
		{
			speakerId: string;
			speakerName: string;
			utterances: Utterance[];
			totalDuration: number;
			utteranceCount: number;
		}
	> = {};

	for (const utterance of props.utterances) {
		const key = utterance.azureSpeakerId;
		if (!groups[key]) {
			groups[key] = {
				speakerId: key,
				speakerName: utterance.speakerName,
				utterances: [],
				totalDuration: 0,
				utteranceCount: 0,
			};
		}
		groups[key].utterances.push(utterance);
		groups[key].totalDuration += utterance.durationSeconds;
		groups[key].utteranceCount += 1;
	}

	return Object.values(groups).sort((a, b) => b.totalDuration - a.totalDuration);
});

// Statistics
const stats = computed(() => ({
	totalUtterances: props.utterances.length,
	totalSpeakers: groupedBySpeaker.value.length,
	totalDuration: props.sessionDurationSeconds,
}));

// Filter utterances by selected speaker
const filteredUtterances = computed(() => {
	if (!props.selectedSpeaker) {
		return props.utterances;
	}
	return props.utterances.filter((u) => u.azureSpeakerId === props.selectedSpeaker);
});

/**
 * Format duration as 分秒
 */
function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}分${secs}秒`;
}

/**
 * Format seconds to mm:ss
 */
function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get consistent color for speaker based on name
 */
function getSpeakerColor(speakerName: string): string {
	const colors = [
		'bg-blue-500',
		'bg-green-500',
		'bg-purple-500',
		'bg-orange-500',
		'bg-pink-500',
		'bg-cyan-500',
		'bg-amber-500',
		'bg-indigo-500',
	];
	const hash = speakerName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
	return colors[hash % colors.length] ?? colors[0] ?? 'bg-gray-500';
}

/**
 * Calculate timeline position as percentage
 */
function getTimelinePosition(seconds: number): number {
	if (props.sessionDurationSeconds === 0) return 0;
	return (seconds / props.sessionDurationSeconds) * 100;
}

/**
 * Calculate timeline segment width as percentage
 */
function getTimelineWidth(duration: number): number {
	if (props.sessionDurationSeconds === 0) return 0;
	return Math.max((duration / props.sessionDurationSeconds) * 100, 1);
}

function handleSpeakerSelect(speakerId: string): void {
	emit('speakerSelect', speakerId);
}

function handleUtteranceClick(utterance: Utterance): void {
	emit('utteranceClick', utterance);
}
</script>

<template>
	<div
		class="speaker-timeline border rounded-lg overflow-hidden bg-white"
		data-testid="speaker-timeline"
	>
		<!-- Empty State -->
		<div
			v-if="utterances.length === 0"
			class="empty-state text-center py-12 text-gray-500"
			data-testid="empty-state"
		>
			<p class="text-lg">発話履歴がありません</p>
			<p class="text-sm mt-2">セッションを開始して話者分離を行ってください</p>
		</div>

		<!-- Content when utterances exist -->
		<template v-else>
			<!-- Statistics Section -->
			<div
				class="stats-section p-4 bg-gray-50 border-b grid grid-cols-3 gap-4"
				data-testid="stats-section"
			>
				<div class="stat text-center">
					<div class="stat-value text-2xl font-bold text-gray-900">
						{{ stats.totalSpeakers }}
					</div>
					<div class="stat-label text-sm text-gray-500">話者数</div>
				</div>
				<div class="stat text-center">
					<div class="stat-value text-2xl font-bold text-gray-900">
						{{ stats.totalUtterances }}
					</div>
					<div class="stat-label text-sm text-gray-500">発話数</div>
				</div>
				<div class="stat text-center">
					<div class="stat-value text-2xl font-bold text-gray-900">
						{{ formatDuration(stats.totalDuration) }}
					</div>
					<div class="stat-label text-sm text-gray-500">合計時間</div>
				</div>
			</div>

			<!-- Speaker Filter Buttons -->
			<div
				class="speaker-filters p-4 border-b flex flex-wrap gap-2"
				data-testid="speaker-filters"
			>
				<button
					type="button"
					class="filter-btn px-3 py-1 rounded-full text-sm transition-colors"
					:class="
						!selectedSpeaker
							? 'bg-gray-800 text-white'
							: 'bg-gray-200 text-gray-700 hover:bg-gray-300'
					"
					data-testid="filter-all"
					@click="handleSpeakerSelect('')"
				>
					全員
				</button>
				<button
					v-for="group in groupedBySpeaker"
					:key="group.speakerId"
					type="button"
					class="filter-btn px-3 py-1 rounded-full text-sm transition-colors"
					:class="
						selectedSpeaker === group.speakerId
							? 'bg-gray-800 text-white'
							: 'bg-gray-200 text-gray-700 hover:bg-gray-300'
					"
					:data-testid="`filter-${group.speakerId}`"
					@click="handleSpeakerSelect(group.speakerId)"
				>
					{{ group.speakerName }} ({{ group.utteranceCount }})
				</button>
			</div>

			<!-- Visual Timeline Section -->
			<div class="timeline-section p-4" data-testid="timeline-section">
				<div class="text-sm font-medium text-gray-700 mb-2">タイムライン</div>
				<div
					class="timeline-track relative h-16 bg-gray-100 rounded overflow-hidden"
					data-testid="timeline-track"
				>
					<div
						v-for="utterance in filteredUtterances"
						:key="utterance.id"
						class="timeline-segment absolute h-full opacity-80 hover:opacity-100 cursor-pointer transition-opacity"
						:class="getSpeakerColor(utterance.speakerName)"
						:style="{
							left: `${getTimelinePosition(utterance.startOffsetSeconds)}%`,
							width: `${getTimelineWidth(utterance.durationSeconds)}%`,
						}"
						:title="`${utterance.speakerName}: ${utterance.text}`"
						:data-testid="`timeline-segment-${utterance.id}`"
						@click="handleUtteranceClick(utterance)"
					/>
				</div>
				<!-- Time axis labels -->
				<div class="time-axis flex justify-between text-xs text-gray-500 mt-1">
					<span>00:00</span>
					<span>{{ formatTime(sessionDurationSeconds / 2) }}</span>
					<span>{{ formatTime(sessionDurationSeconds) }}</span>
				</div>
			</div>

			<!-- Speaker Summary Cards -->
			<div
				class="speaker-cards p-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
				data-testid="speaker-cards"
			>
				<div
					v-for="group in groupedBySpeaker"
					:key="group.speakerId"
					class="speaker-card p-4 border rounded-lg cursor-pointer hover:shadow-md transition-shadow"
					:class="selectedSpeaker === group.speakerId ? 'ring-2 ring-blue-500' : ''"
					:data-testid="`speaker-card-${group.speakerId}`"
					@click="handleSpeakerSelect(group.speakerId)"
				>
					<div class="flex items-center gap-2 mb-2">
						<span
							class="w-3 h-3 rounded-full"
							:class="getSpeakerColor(group.speakerName)"
						/>
						<span class="font-medium text-gray-900">{{ group.speakerName }}</span>
					</div>
					<div class="text-sm text-gray-500">
						<span class="block">発話数: {{ group.utteranceCount }}</span>
						<span class="block">発話時間: {{ formatDuration(group.totalDuration) }}</span>
					</div>
				</div>
			</div>

			<!-- Utterance List -->
			<div class="utterance-list p-4 border-t" data-testid="utterance-list">
				<div class="text-sm font-medium text-gray-700 mb-2">発話一覧</div>
				<div class="space-y-2 max-h-64 overflow-y-auto">
					<div
						v-for="utterance in filteredUtterances"
						:key="utterance.id"
						class="utterance-row p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer transition-colors"
						:data-testid="`utterance-row-${utterance.id}`"
						@click="handleUtteranceClick(utterance)"
					>
						<div class="flex items-center justify-between mb-1">
							<span class="text-sm font-medium text-gray-900">
								{{ utterance.speakerName }}
							</span>
							<span class="text-xs text-gray-500">
								{{ formatTime(utterance.startOffsetSeconds) }}
							</span>
						</div>
						<p class="text-sm text-gray-700">{{ utterance.text }}</p>
					</div>
				</div>
			</div>
		</template>
	</div>
</template>

<style scoped>
.speaker-timeline {
	scrollbar-width: thin;
	scrollbar-color: #d1d5db #f3f4f6;
}

.utterance-list > div::-webkit-scrollbar {
	width: 6px;
}

.utterance-list > div::-webkit-scrollbar-track {
	background: #f3f4f6;
}

.utterance-list > div::-webkit-scrollbar-thumb {
	background-color: #d1d5db;
	border-radius: 3px;
}
</style>
