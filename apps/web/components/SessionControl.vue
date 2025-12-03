<script setup lang="ts">
/**
 * SessionControl component
 * Manages diarization session lifecycle:
 * - Profile selection
 * - Session start/end
 * - Speaker mapping display
 */

import { ref, computed } from 'vue';
import { useDiarizationSession } from '../composables/useDiarizationSession';
import { useVoiceProfile } from '../composables/useVoiceProfile';

// Profile data for enrollment
interface EnrollmentProfile {
	profileId: string;
	profileName: string;
	audioBase64: string;
}

// Emits
const emit = defineEmits<{
	'session-started': [sessionId: string, profiles: EnrollmentProfile[]];
	'session-ended': [];
}>();

// Composables
const {
	sessionId,
	createSession,
	registerAllProfiles,
	endSession,
	clearError,
	status,
	speakerMappings,
	error,
	registrationProgress,
	isActive,
	isRegistering,
	hasError,
} = useDiarizationSession();

const { profiles } = useVoiceProfile();

// Local state
const selectedProfileIds = ref<Set<string>>(new Set());

// Computed
const hasProfiles = computed(() => profiles.value.length > 0);
const hasSelectedProfiles = computed(() => selectedProfileIds.value.size > 0);
const isDisabled = computed(
	() => status.value === 'connecting' || status.value === 'registering'
);

// Status display mapping
const statusLabels: Record<string, string> = {
	idle: '待機中',
	connecting: '接続中',
	registering: '登録中',
	active: 'アクティブ',
	paused: '一時停止',
	ended: '終了',
	error: 'エラー',
};

const statusLabel = computed(() => statusLabels[status.value] || status.value);

// Methods
function toggleProfile(profileId: string) {
	if (selectedProfileIds.value.has(profileId)) {
		selectedProfileIds.value.delete(profileId);
	} else {
		selectedProfileIds.value.add(profileId);
	}
	// Trigger reactivity
	selectedProfileIds.value = new Set(selectedProfileIds.value);
}

function isSelected(profileId: string): boolean {
	return selectedProfileIds.value.has(profileId);
}

async function handleStartSession() {
	const ids = Array.from(selectedProfileIds.value);
	await createSession(ids);

	// Register all selected profiles
	const profilesToRegister = profiles.value
		.filter((p) => selectedProfileIds.value.has(p.id))
		.map((p) => ({
			id: p.id,
			name: p.name,
			audioBase64: p.audioBase64,
		}));

	await registerAllProfiles(profilesToRegister);

	// Emit session-started event with session ID and profiles for enrollment
	if (sessionId.value) {
		const enrollmentProfiles: EnrollmentProfile[] = profilesToRegister.map((p) => ({
			profileId: p.id,
			profileName: p.name,
			audioBase64: p.audioBase64,
		}));
		emit('session-started', sessionId.value, enrollmentProfiles);
	}
}

async function handleEndSession() {
	await endSession();
	emit('session-ended');
}

function handleRetry() {
	clearError();
}
</script>

<template>
	<div class="space-y-6">
		<!-- Status Badge -->
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-semibold">セッション管理</h2>
			<span
				data-testid="status-badge"
				class="px-3 py-1 rounded-full text-sm font-medium"
				:class="{
					'bg-gray-200 text-gray-700': status === 'idle',
					'bg-blue-200 text-blue-700': status === 'connecting',
					'bg-yellow-200 text-yellow-700': status === 'registering',
					'bg-green-200 text-green-700': status === 'active',
					'bg-red-200 text-red-700': status === 'error',
					'bg-gray-300 text-gray-600': status === 'ended',
				}"
			>
				{{ statusLabel }}
			</span>
		</div>

		<!-- Error Display -->
		<div
			v-if="hasError"
			class="bg-red-50 border border-red-200 rounded-lg p-4"
		>
			<p class="text-red-700">{{ error?.message }}</p>
			<button
				data-testid="retry-btn"
				class="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
				@click="handleRetry"
			>
				再試行
			</button>
		</div>

		<!-- Profile Selection (when not active) -->
		<div v-if="!isActive && status !== 'ended'">
			<h3 class="text-lg font-medium mb-3">プロフィール選択</h3>

			<!-- No profiles message -->
			<p v-if="!hasProfiles" class="text-gray-500">
				プロフィールがありません。まず音声プロフィールを作成してください。
			</p>

			<!-- Profile checkboxes -->
			<div v-else class="space-y-2">
				<label
					v-for="profile in profiles"
					:key="profile.id"
					class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50"
					:class="{
						'border-blue-500 bg-blue-50': isSelected(profile.id),
						'border-gray-200': !isSelected(profile.id),
						'opacity-50 cursor-not-allowed': isDisabled,
					}"
				>
					<input
						type="checkbox"
						:checked="isSelected(profile.id)"
						:disabled="isDisabled"
						class="w-5 h-5"
						@change="toggleProfile(profile.id)"
					/>
					<span class="font-medium">{{ profile.name }}</span>
					<span class="text-gray-500 text-sm">
						({{ profile.durationSeconds }}秒)
					</span>
				</label>
			</div>

			<!-- Start Button -->
			<button
				data-testid="start-session-btn"
				:disabled="!hasSelectedProfiles || isDisabled"
				class="mt-4 w-full py-3 rounded-lg font-medium transition-colors"
				:class="{
					'bg-blue-600 text-white hover:bg-blue-700': hasSelectedProfiles && !isDisabled,
					'bg-gray-300 text-gray-500 cursor-not-allowed': !hasSelectedProfiles || isDisabled,
				}"
				@click="handleStartSession"
			>
				セッション開始
			</button>

			<!-- Loading indicator -->
			<div
				v-if="status === 'connecting' || status === 'registering'"
				data-testid="loading-indicator"
				class="mt-4 flex items-center justify-center gap-2"
			>
				<div class="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
				<span class="text-gray-600">
					{{ status === 'connecting' ? '接続中...' : 'プロフィール登録中...' }}
				</span>
			</div>
		</div>

		<!-- Registration Progress -->
		<div v-if="isRegistering && registrationProgress.total > 0" class="space-y-2">
			<div class="flex justify-between text-sm text-gray-600">
				<span>プロフィール登録中</span>
				<span>{{ registrationProgress.current }} / {{ registrationProgress.total }}</span>
			</div>
			<div class="w-full bg-gray-200 rounded-full h-2">
				<div
					data-testid="progress-bar"
					class="bg-blue-600 h-2 rounded-full transition-all"
					:style="{ width: `${(registrationProgress.current / registrationProgress.total) * 100}%` }"
				></div>
			</div>
		</div>

		<!-- Speaker Mappings (when active) -->
		<div v-if="isActive">
			<template v-if="speakerMappings.length > 0">
				<h3 class="text-lg font-medium mb-3">話者マッピング</h3>
				<div class="border rounded-lg overflow-hidden">
					<table class="w-full">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-4 py-2 text-left text-sm font-medium text-gray-600">話者名</th>
								<th class="px-4 py-2 text-left text-sm font-medium text-gray-600">Speaker ID</th>
								<th class="px-4 py-2 text-center text-sm font-medium text-gray-600">状態</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="mapping in speakerMappings"
								:key="mapping.voiceProfileId"
								class="border-t"
							>
								<td class="px-4 py-3">{{ mapping.displayName }}</td>
								<td class="px-4 py-3 font-mono text-sm text-gray-500">
									{{ mapping.azureSpeakerId || '— 認識時に割当' }}
								</td>
							<td class="px-4 py-3 text-center">
								<span
									data-testid="registration-status"
									class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
									:class="{
										'bg-green-100 text-green-700': mapping.azureSpeakerId,
										'bg-gray-100 text-gray-600': !mapping.azureSpeakerId,
									}"
								>
									<span
										class="w-2 h-2 rounded-full"
										:class="{
											'bg-green-500': mapping.azureSpeakerId,
											'bg-gray-400': !mapping.azureSpeakerId,
										}"
									></span>
									{{ mapping.azureSpeakerId ? 'マッピング済み' : '未割当' }}
								</span>
							</td>
							</tr>
						</tbody>
					</table>
				</div>
			</template>

			<!-- End Session Button -->
			<button
				data-testid="end-session-btn"
				class="mt-4 w-full py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
				@click="handleEndSession"
			>
				セッション終了
			</button>
		</div>
	</div>
</template>
