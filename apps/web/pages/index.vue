<template>
  <div class="space-y-8">
    <!-- Page Header -->
    <div class="border-b pb-4">
      <h2 class="text-2xl font-bold text-gray-900">音声プロフィール管理</h2>
      <p class="mt-1 text-gray-600">
        話者認識に使用する音声プロフィールを作成・管理します
      </p>
    </div>

    <!-- Profile Creation Section -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">
        新規プロフィール作成
      </h3>
      
      <!-- Tab Navigation -->
      <div class="border-b border-gray-200 mb-6">
        <nav class="-mb-px flex gap-4">
          <button
            :class="[
              'py-2 px-4 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ]"
            @click="activeTab = 'upload'"
          >
            <span class="flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              ファイルアップロード
            </span>
          </button>
          <button
            :class="[
              'py-2 px-4 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'record'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ]"
            @click="activeTab = 'record'"
          >
            <span class="flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              ブラウザ録音
            </span>
          </button>
        </nav>
      </div>

      <!-- Tab Content -->
      <div v-if="activeTab === 'upload'" class="space-y-4">
        <VoiceProfileUploader @profile-added="handleProfileAdded" />
      </div>
      <div v-else class="space-y-4">
        <VoiceRecorder @profile-added="handleProfileAdded" />
      </div>
    </div>

    <!-- Profile List Section -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">
        登録済みプロフィール
      </h3>
      <ProfileList />
    </div>

    <!-- Success Toast -->
    <Transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="transform opacity-0 translate-y-4"
      enter-to-class="transform opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="transform opacity-100 translate-y-0"
      leave-to-class="transform opacity-0 translate-y-4"
    >
      <div
        v-if="showSuccessToast"
        class="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span>プロフィールを登録しました</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const activeTab = ref<'upload' | 'record'>('upload');
const showSuccessToast = ref(false);

function handleProfileAdded(_profileId: string) {
	showSuccessToast.value = true;
	setTimeout(() => {
		showSuccessToast.value = false;
	}, 3000);
}
</script>
