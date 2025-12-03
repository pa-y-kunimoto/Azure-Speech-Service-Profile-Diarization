<template>
  <div class="space-y-4">
    <!-- Storage Info Banner -->
    <div
      v-if="storageInfo.isNearLimit"
      class="p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-center gap-2"
    >
      <svg class="h-5 w-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span class="text-sm text-yellow-700">
        ストレージ容量が残り少なくなっています（{{ Math.round(storageInfo.usagePercentage * 100) }}% 使用中）
      </span>
    </div>

    <!-- Empty State -->
    <div v-if="profiles.length === 0" class="text-center py-8">
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
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">プロフィールがありません</h3>
      <p class="mt-1 text-sm text-gray-500">
        音声ファイルをアップロードするか、録音してプロフィールを作成してください
      </p>
    </div>

    <!-- Profile List -->
    <ul v-else class="divide-y divide-gray-200">
      <li
        v-for="profile in profiles"
        :key="profile.id"
        class="py-4"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <!-- Avatar -->
            <div
              class="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center"
            >
              <span class="text-white font-medium text-sm">
                {{ getInitials(profile.name) }}
              </span>
            </div>

            <!-- Profile Info -->
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-900 truncate">
                {{ profile.name }}
              </p>
              <div class="flex items-center gap-2 text-xs text-gray-500">
                <span>{{ formatDuration(profile.durationSeconds) }}</span>
                <span>·</span>
                <span>
                  {{ profile.source === "upload" ? "アップロード" : "録音" }}
                </span>
                <span>·</span>
                <span>{{ formatDate(profile.createdAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2">
            <!-- Play Button -->
            <button
              type="button"
              class="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              :title="playingId === profile.id ? '停止' : '再生'"
              @click="togglePlay(profile)"
            >
              <svg
                v-if="playingId !== profile.id"
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <svg
                v-else
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                />
              </svg>
            </button>

            <!-- Delete Button -->
            <button
              type="button"
              class="p-2 text-gray-400 hover:text-red-600 transition-colors"
              title="削除"
              @click="handleDelete(profile.id)"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </li>
    </ul>

    <!-- Clear All Button -->
    <div v-if="profiles.length > 0" class="pt-4 border-t">
      <button
        type="button"
        class="text-sm text-red-600 hover:text-red-700 transition-colors"
        @click="handleClearAll"
      >
        すべてのプロフィールを削除
      </button>
    </div>

    <!-- Hidden Audio Element for Playback -->
    <audio
      ref="audioElement"
      @ended="playingId = null"
    />
  </div>
</template>

<script setup lang="ts">
import type { VoiceProfile } from '@speaker-diarization/core';
import { onUnmounted, ref } from 'vue';
import { useVoiceProfile } from '~/composables/useVoiceProfile';

const { profiles, storageInfo, removeProfile, clearAllProfiles } = useVoiceProfile();

// Audio playback state
const playingId = ref<string | null>(null);
const audioElement = ref<HTMLAudioElement | null>(null);

// Methods
function getInitials(name: string): string {
	const parts = name.trim().split(/\s+/);
	if (parts.length >= 2) {
		return (parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '');
	}
	return name.slice(0, 2).toUpperCase();
}

function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;
}

function formatDate(isoString: string): string {
	const date = new Date(isoString);
	return date.toLocaleDateString('ja-JP', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function togglePlay(profile: VoiceProfile) {
	if (!audioElement.value) return;

	if (playingId.value === profile.id) {
		// Stop playing
		audioElement.value.pause();
		audioElement.value.currentTime = 0;
		playingId.value = null;
	} else {
		// Start playing
		const audioSrc = `data:audio/wav;base64,${profile.audioBase64}`;
		audioElement.value.src = audioSrc;
		audioElement.value.play();
		playingId.value = profile.id;
	}
}

function handleDelete(profileId: string) {
	if (confirm('このプロフィールを削除しますか？')) {
		if (playingId.value === profileId && audioElement.value) {
			audioElement.value.pause();
			playingId.value = null;
		}
		removeProfile(profileId);
	}
}

function handleClearAll() {
	if (confirm('すべてのプロフィールを削除しますか？この操作は取り消せません。')) {
		if (audioElement.value) {
			audioElement.value.pause();
		}
		playingId.value = null;
		clearAllProfiles();
	}
}

// Cleanup
onUnmounted(() => {
	if (audioElement.value) {
		audioElement.value.pause();
	}
});
</script>
