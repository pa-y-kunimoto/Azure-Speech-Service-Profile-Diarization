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

      <!-- Automatic Speaker Mappings (from enrollment) -->
      <div v-if="recognition.speakerMappings.value.length > 0" class="mb-4">
        <h4 class="text-sm font-medium text-gray-700 mb-2">自動マッピング済みプロフィール</h4>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="mapping in recognition.speakerMappings.value"
            :key="mapping.speakerId"
            class="px-3 py-1 rounded text-sm font-medium bg-green-100 text-green-800"
          >
            {{ mapping.profileName }}
            <span class="text-green-600 text-xs ml-1">({{ mapping.speakerId }})</span>
            <span class="ml-1 text-green-600">✓</span>
          </span>
        </div>
      </div>

      <!-- Detected Speakers with Manual Mapping -->
      <div v-if="recognition.detectedSpeakers.value.length > 0" class="mb-4">
        <h4 class="text-sm font-medium text-gray-700 mb-2">検出された話者（クリックでプロフィールを割り当て）</h4>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="speakerId in recognition.detectedSpeakers.value"
            :key="speakerId"
            type="button"
            class="px-3 py-1 rounded text-sm font-medium transition-colors"
            :class="getMappedProfile(speakerId) 
              ? 'bg-green-100 text-green-800 hover:bg-green-200' 
              : 'bg-blue-100 text-blue-800 hover:bg-blue-200'"
            @click="openSpeakerMappingDialog(speakerId)"
          >
            {{ getMappedProfile(speakerId) || speakerId }}
            <span v-if="getMappedProfile(speakerId)" class="ml-1 text-green-600">✓</span>
          </button>
        </div>
      </div>

      <!-- Speaker Mapping Dialog -->
      <div
        v-if="showMappingDialog"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        @click.self="closeMappingDialog"
      >
        <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
          <h3 class="text-lg font-semibold mb-4">話者をプロフィールに割り当て</h3>
          <p class="text-sm text-gray-600 mb-4">
            「{{ mappingDialogSpeakerId }}」をどのプロフィールに割り当てますか？
          </p>
          <div class="space-y-2 mb-4">
            <button
              v-for="profile in availableProfiles"
              :key="profile.id"
              type="button"
              class="w-full px-4 py-2 text-left rounded-lg border hover:bg-gray-50 transition-colors"
              :class="{ 'border-blue-500 bg-blue-50': selectedMappingProfile === profile.id }"
              @click="selectedMappingProfile = profile.id"
            >
              {{ profile.name }}
            </button>
          </div>
          <div class="flex gap-2 justify-end">
            <button
              type="button"
              class="px-4 py-2 text-gray-600 hover:text-gray-800"
              @click="closeMappingDialog"
            >
              キャンセル
            </button>
            <button
              type="button"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              :disabled="!selectedMappingProfile"
              @click="confirmSpeakerMapping"
            >
              割り当て
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Real-time Transcript Section -->
    <div v-if="sessionId" class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">
        リアルタイム発話
      </h3>
      <TranscriptView
        :utterances="mappedUtterances"
        :interim-text="recognition.interimText.value"
        :interim-speaker="mappedInterimSpeaker"
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
    <div v-if="showResults" class="bg-white rounded-lg shadow p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">
          セッション結果
        </h3>
        <button
          v-if="!showResults || recognition.utterances.value.length > 0"
          type="button"
          class="text-sm text-blue-600 hover:text-blue-800"
          @click="toggleResults"
        >
          {{ showResults ? '結果を隠す' : '結果を表示' }}
        </button>
      </div>
      <SpeakerTimeline
        :utterances="transformedUtterances"
        :speaker-mappings="speakerMappings"
        :session-duration-seconds="sessionDurationSeconds"
        :selected-speaker="selectedSpeaker"
        @speaker-select="handleTimelineSpeakerSelect"
        @utterance-click="handleUtteranceClick"
      />
    </div>

    <!-- Show Results Button (when collapsed) -->
    <div
      v-else-if="recognition.utterances.value.length > 0"
      class="bg-white rounded-lg shadow p-4 text-center"
    >
      <button
        type="button"
        class="text-blue-600 hover:text-blue-800 font-medium"
        @click="toggleResults"
      >
        セッション結果を表示 ({{ recognition.utterances.value.length }} 発話)
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { useRealtimeRecognition } from '~/composables/useRealtimeRecognition';
import { useVoiceProfile } from '~/composables/useVoiceProfile';
import type { SpeakerMapping } from '@speaker-diarization/core';

// Session state
const sessionId = ref<string | null>(null);

// Voice profiles for manual mapping
const { profiles: availableProfiles } = useVoiceProfile();

// Initialize recognition composable when session starts
let recognition = useRealtimeRecognition({
  sessionId: 'placeholder'
});

// Manual speaker mapping state
const showMappingDialog = ref(false);
const mappingDialogSpeakerId = ref('');
const selectedMappingProfile = ref<string | null>(null);
const manualSpeakerMappings = ref<Map<string, { profileId: string; profileName: string }>>(new Map());

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
 * Profile data for enrollment
 */
interface EnrollmentProfile {
  profileId: string;
  profileName: string;
  audioBase64: string;
}

// Enrollment profiles received from SessionControl
const enrollmentProfiles = ref<EnrollmentProfile[]>([]);

/**
 * Handle session started event from SessionControl
 */
function handleSessionStarted(id: string, profiles: EnrollmentProfile[]) {
  sessionId.value = id;
  sessionStartTime.value = Date.now();
  showResults.value = false;
  selectedSpeaker.value = null;
  enrollmentProfiles.value = profiles;
  
  // Reinitialize recognition with correct session ID
  recognition = useRealtimeRecognition({
    sessionId: id,
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
  // Show results after session ends if there are utterances
  if (recognition.utterances.value.length > 0) {
    showResults.value = true;
  }
}

/**
 * Start real-time recognition
 * First enrolls profiles to learn speakers, then starts mic capture
 */
async function startRecognition() {
  try {
    // If we have enrollment profiles, enroll them first
    // Enrollment also starts transcription, so we don't need to call start() separately
    if (enrollmentProfiles.value.length > 0) {
      console.log('Enrolling profiles before starting recognition...');
      await recognition.enrollProfiles(enrollmentProfiles.value);
      // Clear enrollment profiles after successful enrollment
      enrollmentProfiles.value = [];
      // Start microphone capture only (transcription is already started by enroll)
      await recognition.startMicrophoneCapture();
    } else {
      // No profiles to enroll, start normally
      await recognition.start();
    }
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

// Session results state
const showResults = ref(false);
const selectedSpeaker = ref<string | null>(null);
const sessionStartTime = ref<number | null>(null);
const speakerMappings = ref<SpeakerMapping[]>([]);

// Calculate session duration
const sessionDurationSeconds = computed(() => {
  if (!sessionStartTime.value) return 0;
  const now = Date.now();
  return Math.floor((now - sessionStartTime.value) / 1000);
});

// Utterances with speaker mappings applied (both automatic and manual)
const mappedUtterances = computed(() => {
  return recognition.utterances.value.map(utterance => {
    // First check manual mappings
    const manualMapping = manualSpeakerMappings.value.get(utterance.speakerId);
    if (manualMapping) {
      return {
        ...utterance,
        speakerName: manualMapping.profileName,
      };
    }
    
    // Then check automatic mappings from enrollment
    const autoMapping = recognition.speakerMappings.value.find(m => m.speakerId === utterance.speakerId);
    if (autoMapping) {
      return {
        ...utterance,
        speakerName: autoMapping.profileName,
      };
    }
    
    return utterance;
  });
});

// Interim speaker with mapping applied (both automatic and manual)
const mappedInterimSpeaker = computed(() => {
  const interimSpeakerId = recognition.interimSpeaker.value;
  if (interimSpeakerId) {
    // First check manual mappings
    const manualMapping = manualSpeakerMappings.value.get(interimSpeakerId);
    if (manualMapping) {
      return manualMapping.profileName;
    }
    
    // Then check automatic mappings from enrollment
    const autoMapping = recognition.speakerMappings.value.find(m => m.speakerId === interimSpeakerId);
    if (autoMapping) {
      return autoMapping.profileName;
    }
  }
  return recognition.interimSpeaker.value;
});

// Transform utterances to match SpeakerTimeline's expected type
const transformedUtterances = computed(() => {
  return mappedUtterances.value.map(utterance => ({
    ...utterance,
    sessionId: sessionId.value || '',
    azureSpeakerId: utterance.speakerId,
    startOffsetSeconds: utterance.offsetMs / 1000,
    endOffsetSeconds: (utterance.offsetMs / 1000) + 3, // Approximate duration
    durationSeconds: 3, // Approximate duration
    recognizedAt: utterance.timestamp,
    createdAt: new Date(utterance.timestamp),
    updatedAt: new Date(utterance.timestamp),
  }));
});

/**
 * Toggle results section visibility
 */
function toggleResults() {
  showResults.value = !showResults.value;
}

/**
 * Handle speaker selection from timeline
 */
function handleTimelineSpeakerSelect(speakerId: string) {
  selectedSpeaker.value = speakerId === selectedSpeaker.value ? null : speakerId;
}

/**
 * Handle utterance click from timeline
 */
function handleUtteranceClick(utterance: { id: string; text: string; speakerName: string }) {
  console.log('Utterance clicked:', utterance);
  // Could scroll to or highlight the utterance
}

/**
 * Get the mapped profile name for a speaker ID
 * Checks both automatic mappings from enrollment and manual mappings
 */
function getMappedProfile(speakerId: string): string | null {
  // First check manual mappings (takes priority)
  const manualMapping = manualSpeakerMappings.value.get(speakerId);
  if (manualMapping) {
    return manualMapping.profileName;
  }
  
  // Then check automatic mappings from enrollment
  const autoMapping = recognition.speakerMappings.value.find(m => m.speakerId === speakerId);
  if (autoMapping) {
    return autoMapping.profileName;
  }
  
  return null;
}

/**
 * Open the speaker mapping dialog
 */
function openSpeakerMappingDialog(speakerId: string) {
  mappingDialogSpeakerId.value = speakerId;
  selectedMappingProfile.value = null;
  showMappingDialog.value = true;
}

/**
 * Close the speaker mapping dialog
 */
function closeMappingDialog() {
  showMappingDialog.value = false;
  mappingDialogSpeakerId.value = '';
  selectedMappingProfile.value = null;
}

/**
 * Confirm the speaker mapping
 */
function confirmSpeakerMapping() {
  if (!selectedMappingProfile.value || !mappingDialogSpeakerId.value) {
    return;
  }
  
  // Find the selected profile
  const profile = availableProfiles.value.find(p => p.id === selectedMappingProfile.value);
  if (!profile) {
    return;
  }
  
  // Save the mapping locally
  manualSpeakerMappings.value.set(mappingDialogSpeakerId.value, {
    profileId: profile.id,
    profileName: profile.name,
  });
  
  // Call the recognition mapSpeaker function to update the backend
  recognition.mapSpeaker(mappingDialogSpeakerId.value, profile.id, profile.name);
  
  closeMappingDialog();
}

// Cleanup on unmount
onUnmounted(() => {
  recognition.disconnect();
});
</script>
