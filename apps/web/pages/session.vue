<template>
  <div class="space-y-8">
    <!-- Page Header -->
    <div class="border-b pb-4">
      <h2 class="text-2xl font-bold text-gray-900">話者分離セッション</h2>
      <p class="mt-1 text-gray-600">
        リアルタイムで話者を識別し、発話をテキストで表示します
      </p>
    </div>

    <!-- Session Control Section -->
    <div class="bg-white rounded-lg shadow p-6">
      <SessionControl 
        @session-started="handleSessionStarted"
        @session-ended="handleSessionEnded"
      />
    </div>

    <!-- Real-time Controls -->
    <div v-if="sessionId" class="bg-white rounded-lg shadow p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">
          リアルタイム認識
        </h3>
        <div class="flex items-center gap-2">
          <span 
            :class="[
              'px-2 py-1 rounded text-sm font-medium',
              statusColors[recognition.status.value]
            ]"
          >
            {{ statusLabels[recognition.status.value] }}
          </span>
        </div>
      </div>

      <!-- Control Buttons -->
      <div class="flex gap-3 mb-4">
        <button
          v-if="!recognition.isActive.value"
          type="button"
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          :disabled="recognition.status.value === 'connecting'"
          @click="startRecognition"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          認識開始
        </button>

        <button
          v-else
          type="button"
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          @click="stopRecognition"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          認識停止
        </button>

        <button
          type="button"
          class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          @click="recognition.clearUtterances"
        >
          クリア
        </button>
      </div>

      <!-- Error Message -->
      <div
        v-if="recognition.error.value"
        class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4"
      >
        <span class="font-medium">エラー:</span> {{ recognition.error.value.message }}
        <span v-if="recognition.error.value.recoverable" class="text-red-500 ml-2">
          (リトライ可能)
        </span>
      </div>

      <!-- Detected Speakers -->
      <div v-if="recognition.detectedSpeakers.value.length > 0" class="mb-4">
        <h4 class="text-sm font-medium text-gray-700 mb-2">検出された話者</h4>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="speakerId in recognition.detectedSpeakers.value"
            :key="speakerId"
            class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
          >
            {{ speakerId }}
          </span>
        </div>
      </div>
    </div>

    <!-- Real-time Transcript Section -->
    <div v-if="sessionId" class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">
        リアルタイム発話
      </h3>
      <TranscriptView
        :utterances="recognition.utterances.value"
        :interim-text="recognition.interimText.value"
        :interim-speaker="recognition.interimSpeaker.value"
        :is-active="recognition.isActive.value"
        @speaker-click="handleSpeakerClick"
      />
    </div>

    <!-- No Session State -->
    <div v-else class="bg-white rounded-lg shadow p-6">
      <div class="text-center py-8 text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <p class="text-lg">セッションが開始されていません</p>
        <p class="text-sm mt-2">上のセクションでプロフィールを選択してセッションを開始してください</p>
      </div>
    </div>

    <!-- Session Results Section -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">
        セッション結果
      </h3>
      <!-- SpeakerTimeline will be added here -->
      <p class="text-gray-500 text-center py-8">
        SpeakerTimeline コンポーネント（Phase 7 で実装）
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { useRealtimeRecognition } from '~/composables/useRealtimeRecognition';

// Session state
const sessionId = ref<string | null>(null);

// Initialize recognition composable when session starts
let recognition = useRealtimeRecognition({
  sessionId: 'placeholder',
  apiBaseUrl: 'ws://localhost:3001',
});

// Status display configuration
const statusLabels: Record<string, string> = {
  idle: '待機中',
  connecting: '接続中...',
  connected: '接続済み',
  active: '認識中',
  paused: '一時停止',
  error: 'エラー',
  ended: '終了',
};

const statusColors: Record<string, string> = {
  idle: 'bg-gray-100 text-gray-800',
  connecting: 'bg-yellow-100 text-yellow-800',
  connected: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  paused: 'bg-orange-100 text-orange-800',
  error: 'bg-red-100 text-red-800',
  ended: 'bg-gray-100 text-gray-800',
};

/**
 * Handle session started event from SessionControl
 */
function handleSessionStarted(id: string) {
  sessionId.value = id;
  
  // Reinitialize recognition with correct session ID
  recognition = useRealtimeRecognition({
    sessionId: id,
    apiBaseUrl: 'ws://localhost:3001',
    onError: (error) => {
      console.error('Recognition error:', error);
    },
  });
}

/**
 * Handle session ended event from SessionControl
 */
function handleSessionEnded() {
  recognition.disconnect();
  sessionId.value = null;
}

/**
 * Start real-time recognition
 */
async function startRecognition() {
  try {
    await recognition.start();
  } catch (error) {
    console.error('Failed to start recognition:', error);
  }
}

/**
 * Stop real-time recognition
 */
async function stopRecognition() {
  try {
    await recognition.stop();
  } catch (error) {
    console.error('Failed to stop recognition:', error);
  }
}

/**
 * Handle speaker badge click
 */
function handleSpeakerClick(speakerId: string, speakerName: string) {
  console.log('Speaker clicked:', speakerId, speakerName);
  // Could open a dialog to rename/map the speaker
}

// Cleanup on unmount
onUnmounted(() => {
  recognition.disconnect();
});
</script>
