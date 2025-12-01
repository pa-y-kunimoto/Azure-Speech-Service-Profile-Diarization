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
      />
      <p v-if="nameError" class="mt-1 text-sm text-red-600">
        {{ nameError }}
      </p>
      <p class="mt-1 text-xs text-gray-500">
        {{ speakerName.length }}/50 文字
      </p>
    </div>

    <!-- File Upload -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">
        音声ファイル
      </label>
      <div
        :class="[
          'relative border-2 border-dashed rounded-lg p-6 text-center transition-colors',
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400',
        ]"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
      >
        <input
          ref="fileInput"
          type="file"
          accept="audio/wav,audio/wave,audio/x-wav,audio/mpeg,audio/mp3,.wav,.mp3"
          class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          @change="handleFileSelect"
        />

        <div v-if="!selectedFile" class="space-y-2">
          <svg
            class="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          <div class="text-gray-600">
            <span class="font-medium text-blue-600">ファイルを選択</span>
            またはドラッグ&ドロップ
          </div>
          <p class="text-xs text-gray-500">
            WAV または MP3 形式（5秒以上）
          </p>
        </div>

        <div v-else class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <svg
              class="h-8 w-8 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div class="text-left">
              <p class="text-sm font-medium text-gray-900">
                {{ selectedFile.name }}
              </p>
              <p class="text-xs text-gray-500">
                {{ formatFileSize(selectedFile.size) }}
                <span v-if="audioDuration">
                  · {{ formatDuration(audioDuration) }}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            class="text-gray-400 hover:text-gray-600"
            @click.stop="clearFile"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
      <p v-if="fileError" class="mt-1 text-sm text-red-600">
        {{ fileError }}
      </p>
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

    <!-- Submit Button -->
    <div class="flex items-center justify-between pt-4">
      <div v-if="isProcessing" class="flex items-center gap-2 text-blue-600">
        <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span class="text-sm">音声を処理中...</span>
      </div>
      <div v-else />

      <button
        type="button"
        :disabled="!canSubmit"
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        @click="handleSubmit"
      >
        プロフィールを登録
      </button>
    </div>

    <!-- Error Message -->
    <div
      v-if="submitError"
      class="p-3 bg-red-50 border border-red-200 rounded-md"
    >
      <p class="text-sm text-red-700">{{ submitError }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useVoiceProfile } from '~/composables/useVoiceProfile';
import {
	convertAudioToBase64Wav,
	getAudioDuration,
	isSupportedFormat,
} from '~/utils/audioConverter';

const emit = defineEmits<{
	profileAdded: [/** profileId */ string];
}>();

const { addProfile } = useVoiceProfile();

// Form state
const speakerName = ref('');
const selectedFile = ref<File | null>(null);
const audioPreviewUrl = ref<string | null>(null);
const audioDuration = ref<number | null>(null);

// UI state
const isDragging = ref(false);
const isProcessing = ref(false);

// Error state
const nameError = ref<string | null>(null);
const fileError = ref<string | null>(null);
const submitError = ref<string | null>(null);

// File input ref
const fileInput = ref<HTMLInputElement | null>(null);

// Computed
const canSubmit = computed(() => {
	return (
		speakerName.value.trim().length >= 1 &&
		speakerName.value.length <= 50 &&
		selectedFile.value !== null &&
		audioDuration.value !== null &&
		audioDuration.value >= 5 &&
		!isProcessing.value
	);
});

// Watchers
watch(speakerName, (value) => {
	if (value.length === 0) {
		nameError.value = '話者名を入力してください';
	} else if (value.length > 50) {
		nameError.value = '話者名は50文字以内で入力してください';
	} else {
		nameError.value = null;
	}
});

// Methods
function handleFileSelect(event: Event) {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	if (file) {
		processFile(file);
	}
}

function handleDrop(event: DragEvent) {
	isDragging.value = false;
	const file = event.dataTransfer?.files[0];
	if (file) {
		processFile(file);
	}
}

async function processFile(file: File) {
	fileError.value = null;
	submitError.value = null;

	// Validate file type
	if (!isSupportedFormat(file.type)) {
		fileError.value = 'WAV または MP3 形式のファイルを選択してください';
		return;
	}

	// Get duration
	try {
		const duration = await getAudioDuration(file);
		if (duration < 5) {
			fileError.value = `音声の長さ（${duration.toFixed(1)}秒）が5秒未満です。Azure Speech Service には5秒以上の音声が必要です`;
			return;
		}
		audioDuration.value = duration;
	} catch {
		fileError.value = '音声ファイルの読み込みに失敗しました';
		return;
	}

	selectedFile.value = file;

	// Create preview URL
	if (audioPreviewUrl.value) {
		URL.revokeObjectURL(audioPreviewUrl.value);
	}
	audioPreviewUrl.value = URL.createObjectURL(file);
}

function clearFile() {
	selectedFile.value = null;
	audioDuration.value = null;
	fileError.value = null;
	if (audioPreviewUrl.value) {
		URL.revokeObjectURL(audioPreviewUrl.value);
		audioPreviewUrl.value = null;
	}
	if (fileInput.value) {
		fileInput.value.value = '';
	}
}

async function handleSubmit() {
	if (!canSubmit.value || !selectedFile.value || audioDuration.value === null) {
		return;
	}

	isProcessing.value = true;
	submitError.value = null;

	try {
		// Convert audio to WAV Base64
		const conversionResult = await convertAudioToBase64Wav(selectedFile.value);

		if (!conversionResult.success || !conversionResult.audioBase64) {
			submitError.value = conversionResult.error ?? '音声の変換に失敗しました';
			return;
		}

		// Add profile
		const result = addProfile({
			name: speakerName.value.trim(),
			audioBase64: conversionResult.audioBase64,
			durationSeconds: audioDuration.value,
			source: 'upload',
		});

		if (result.success && result.profile) {
			emit('profileAdded', result.profile.id);
			// Reset form
			speakerName.value = '';
			clearFile();
		} else {
			submitError.value =
				result.errors?.map((e) => e.message).join(', ') ?? 'プロフィールの登録に失敗しました';
		}
	} catch (error) {
		submitError.value = error instanceof Error ? error.message : 'エラーが発生しました';
	} finally {
		isProcessing.value = false;
	}
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}秒`;
}

// Cleanup
onUnmounted(() => {
	if (audioPreviewUrl.value) {
		URL.revokeObjectURL(audioPreviewUrl.value);
	}
});
</script>
