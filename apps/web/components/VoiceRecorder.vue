<template>
  <div class="space-y-4">
    <!-- Name Input -->
    <div>
      <label for="speaker-name" class="block text-sm font-medium text-gray-700 mb-1">
        話者名
      </label>
      <input
        id="speaker-name"
        v-model="speakerName"
        type="text"
        maxlength="50"
        placeholder="例: 田中太郎"
        class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        :class="{ 'border-red-500': nameError }"
        :disabled="isRecording && !isPaused"
      />
      <p v-if="nameError" class="mt-1 text-sm text-red-600">
        {{ nameError }}
      </p>
      <p class="mt-1 text-xs text-gray-500">
        {{ speakerName.length }}/50 文字
      </p>
    </div>

    <!-- Permission Request -->
    <div v-if="hasPermission === null" class="p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div class="flex items-center gap-3">
        <svg class="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <div>
          <p class="text-sm font-medium text-blue-800">マイクへのアクセス許可が必要です</p>
          <p class="text-xs text-blue-600">録音を開始するには、マイクの使用を許可してください</p>
        </div>
      </div>
      <button
        type="button"
        class="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        @click="handleRequestPermission"
      >
        マイクの使用を許可
      </button>
    </div>

    <!-- Permission Denied -->
    <div v-else-if="hasPermission === false" class="p-4 bg-red-50 rounded-lg border border-red-200">
      <div class="flex items-center gap-3">
        <svg class="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <p class="text-sm font-medium text-red-800">マイクへのアクセスが拒否されました</p>
          <p class="text-xs text-red-600">ブラウザの設定でマイクの使用を許可してください</p>
        </div>
      </div>
    </div>

    <!-- Recording Section -->
    <div v-else class="space-y-4">
      <!-- Audio Level Visualization -->
      <div class="relative h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          class="absolute inset-y-0 left-0 bg-green-500 transition-all duration-75"
          :style="{ width: `${audioLevel * 100}%` }"
        />
      </div>

      <!-- Recording Duration -->
      <div class="text-center">
        <div class="text-4xl font-mono font-bold" :class="isRecording ? 'text-red-600' : 'text-gray-700'">
          {{ formatDuration(duration) }}
        </div>
        <div class="mt-1 flex items-center justify-center gap-2">
          <div
            v-if="isRecording && !isPaused"
            class="w-3 h-3 rounded-full bg-red-500 animate-pulse"
          />
          <span class="text-sm text-gray-500">
            <template v-if="!isRecording && !audioBlob">
              最低 5 秒以上の録音が必要です
            </template>
            <template v-else-if="isRecording && !meetsMinDuration">
              あと {{ 5 - duration }} 秒必要です
            </template>
            <template v-else-if="isRecording && meetsMinDuration">
              録音中... いつでも停止できます
            </template>
            <template v-else-if="audioBlob">
              録音完了
            </template>
          </span>
        </div>

        <!-- Minimum Duration Progress -->
        <div v-if="isRecording && !meetsMinDuration" class="mt-2 w-full h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            class="h-full bg-blue-500 transition-all duration-300"
            :style="{ width: `${Math.min(100, (duration / 5) * 100)}%` }"
          />
        </div>
      </div>

      <!-- Recording Controls -->
      <div class="flex items-center justify-center gap-4">
        <!-- Not Recording: Start Button -->
        <template v-if="!isRecording && !audioBlob">
          <button
            type="button"
            class="flex items-center justify-center w-16 h-16 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-lg"
            @click="handleStartRecording"
          >
            <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
            </svg>
          </button>
        </template>

        <!-- Recording: Pause/Resume, Stop, Cancel -->
        <template v-else-if="isRecording">
          <!-- Cancel Button -->
          <button
            type="button"
            class="flex items-center justify-center w-12 h-12 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors"
            title="キャンセル"
            @click="handleCancel"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- Pause/Resume Button -->
          <button
            type="button"
            class="flex items-center justify-center w-12 h-12 bg-yellow-500 text-white rounded-full hover:bg-yellow-600 transition-colors"
            :title="isPaused ? '再開' : '一時停止'"
            @click="isPaused ? handleResume() : handlePause()"
          >
            <svg v-if="!isPaused" class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
            <svg v-else class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>

          <!-- Stop Button (enabled only when minimum duration met) -->
          <button
            type="button"
            class="flex items-center justify-center w-16 h-16 rounded-full transition-colors shadow-lg"
            :class="meetsMinDuration ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'"
            :disabled="!meetsMinDuration"
            title="録音停止"
            @click="handleStop"
          >
            <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
          </button>
        </template>

        <!-- Recording Complete: Preview and Actions -->
        <template v-else-if="audioBlob">
          <!-- Re-record Button -->
          <button
            type="button"
            class="flex items-center justify-center w-12 h-12 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors"
            title="やり直し"
            @click="handleReRecord"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          <!-- Save Button -->
          <button
            type="button"
            class="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canSave || isProcessing"
            @click="handleSave"
          >
            <svg v-if="!isProcessing" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>{{ isProcessing ? '処理中...' : '保存する' }}</span>
          </button>
        </template>
      </div>

      <!-- Audio Preview -->
      <div v-if="audioPreviewUrl" class="space-y-2">
        <label class="block text-sm font-medium text-gray-700">
          プレビュー
        </label>
        <audio
          :src="audioPreviewUrl"
          controls
          class="w-full"
        />
      </div>

      <!-- Error Message -->
      <div v-if="error || saveError" class="p-3 bg-red-50 border border-red-200 rounded-md">
        <p class="text-sm text-red-700">{{ error || saveError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useAudioRecorder } from '~/composables/useAudioRecorder';
import { useVoiceProfile } from '~/composables/useVoiceProfile';

const emit = defineEmits<{
	profileAdded: [/** profileId */ string];
}>();

// Composables
const {
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
	getBase64Wav,
} = useAudioRecorder({ minDuration: 5 });

const { addProfile } = useVoiceProfile();

// Form state
const speakerName = ref('');
const audioPreviewUrl = ref<string | null>(null);
const isProcessing = ref(false);
const saveError = ref<string | null>(null);

// Validation
const nameError = computed(() => {
	if (speakerName.value.length === 0) return null;
	if (speakerName.value.length > 50) return '話者名は50文字以内で入力してください';
	return null;
});

const canSave = computed(() => {
	return (
		speakerName.value.trim().length >= 1 &&
		speakerName.value.length <= 50 &&
		audioBlob.value !== null &&
		!isProcessing.value
	);
});

// Watch for audio blob changes to create preview URL
watch(audioBlob, (newBlob) => {
	if (audioPreviewUrl.value) {
		URL.revokeObjectURL(audioPreviewUrl.value);
		audioPreviewUrl.value = null;
	}
	if (newBlob) {
		audioPreviewUrl.value = URL.createObjectURL(newBlob);
	}
});

// Format duration as mm:ss
function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Handlers
async function handleRequestPermission() {
	await requestPermission();
}

async function handleStartRecording() {
	saveError.value = null;
	await startRecording();
}

function handlePause() {
	pauseRecording();
}

function handleResume() {
	resumeRecording();
}

async function handleStop() {
	await stopRecording();
}

function handleCancel() {
	cancelRecording();
	if (audioPreviewUrl.value) {
		URL.revokeObjectURL(audioPreviewUrl.value);
		audioPreviewUrl.value = null;
	}
}

function handleReRecord() {
	reset();
	if (audioPreviewUrl.value) {
		URL.revokeObjectURL(audioPreviewUrl.value);
		audioPreviewUrl.value = null;
	}
}

async function handleSave() {
	if (!canSave.value) return;

	isProcessing.value = true;
	saveError.value = null;

	try {
		// Convert to base64 WAV
		const base64Wav = await getBase64Wav();
		if (!base64Wav) {
			saveError.value = '音声データの変換に失敗しました';
			return;
		}

		// Add profile
		const result = addProfile({
			name: speakerName.value.trim(),
			audioBase64: base64Wav,
			durationSeconds: duration.value,
			source: 'recording',
		});

		if (result.success && result.profile) {
			emit('profileAdded', result.profile.id);
			// Reset for next recording
			speakerName.value = '';
			reset();
			if (audioPreviewUrl.value) {
				URL.revokeObjectURL(audioPreviewUrl.value);
				audioPreviewUrl.value = null;
			}
		} else {
			saveError.value = result.errors?.[0]?.message || 'プロフィールの保存に失敗しました';
		}
	} catch (err) {
		saveError.value = err instanceof Error ? err.message : 'プロフィールの保存に失敗しました';
	} finally {
		isProcessing.value = false;
	}
}

// Cleanup on unmount
onUnmounted(() => {
	if (audioPreviewUrl.value) {
		URL.revokeObjectURL(audioPreviewUrl.value);
	}
});
</script>
