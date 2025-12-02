/**
 * useDiarizationSession composable
 * Manages Azure Speech Service diarization session state
 *
 * Features:
 * - Session creation with profile selection
 * - Profile registration with Azure
 * - Speaker mapping management
 * - Session lifecycle (create, active, end)
 */

import { ref, computed } from 'vue';
import type { SpeakerMapping } from '@speaker-diarization/core';
import { useApiFetch } from './useApiFetch';

// Session status type matching API schema
type DiarizationSessionStatus =
	| 'idle'
	| 'connecting'
	| 'registering'
	| 'active'
	| 'paused'
	| 'ended'
	| 'error';

// Types for session response from API
interface SessionResponse {
	id: string;
	status: DiarizationSessionStatus;
	createdAt: string;
	endedAt?: string;
	speakerMappings: SpeakerMapping[];
	error?: {
		code: string;
		message: string;
	};
}

interface SpeakerMappingResponse {
	speakerId: string;
	profileId: string;
	profileName: string;
}

interface ProfileToRegister {
	id: string;
	name: string;
	audioBase64: string;
}

interface RegistrationProgress {
	current: number;
	total: number;
}

export function useDiarizationSession() {
	// API fetch helper
	const { apiFetch } = useApiFetch();

	// State
	const sessionId = ref<string | null>(null);
	const status = ref<DiarizationSessionStatus>('idle');
	const speakerMappings = ref<SpeakerMapping[]>([]);
	const error = ref<Error | null>(null);
	const registrationProgress = ref<RegistrationProgress>({ current: 0, total: 0 });

	// Computed
	const isActive = computed(() => status.value === 'active');
	const isRegistering = computed(() => status.value === 'registering');
	const hasError = computed(() => error.value !== null);

	/**
	 * Create a new diarization session
	 */
	async function createSession(profileIds: string[]): Promise<void> {
		// Validate input
		if (!profileIds || profileIds.length === 0) {
			error.value = new Error('少なくとも1つのプロフィールを選択してください');
			return;
		}

		try {
			error.value = null;
			status.value = 'connecting';

			const response = await apiFetch<SessionResponse>('/api/session', {
				method: 'POST',
				body: { profileIds },
			});

			sessionId.value = response.id;
			status.value = response.status;
			speakerMappings.value = response.speakerMappings || [];
		} catch (err) {
			error.value = err instanceof Error ? err : new Error(String(err));
			status.value = 'error';
		}
	}

	/**
	 * Register a single profile with Azure
	 */
	async function registerProfile(
		profileId: string,
		profileName: string,
		audioBase64: string
	): Promise<void> {
		if (!sessionId.value) {
			error.value = new Error('アクティブなセッションがありません');
			return;
		}

		try {
			const previousStatus = status.value;
			status.value = 'registering';

			const response = await apiFetch<SpeakerMappingResponse>(
				`/api/session/${sessionId.value}/register-profile`,
				{
					method: 'POST',
					body: {
						profileId,
						profileName,
						audioBase64,
					},
				}
			);

			// Add to speaker mappings
			speakerMappings.value = [
				...speakerMappings.value,
				{
					voiceProfileId: response.profileId,
					displayName: response.profileName,
					azureSpeakerId: response.speakerId,
                    status: 'completed',
					sessionId: sessionId.value,
				},
			];

			// Restore status or set to active if all registered
			status.value = previousStatus === 'connecting' ? 'idle' : previousStatus;
		} catch (err) {
			error.value = err instanceof Error ? err : new Error(String(err));
		}
	}

	/**
	 * Register all profiles sequentially
	 */
	async function registerAllProfiles(profiles: ProfileToRegister[]): Promise<void> {
		registrationProgress.value = { current: 0, total: profiles.length };
		status.value = 'registering';

		for (const profile of profiles) {
			await registerProfile(profile.id, profile.name, profile.audioBase64);
			registrationProgress.value = {
				current: registrationProgress.value.current + 1,
				total: profiles.length,
			};

			// Check for errors
			if (error.value) {
				break;
			}
		}

		if (!error.value) {
			status.value = 'active';
		}
	}

	/**
	 * Get session state from server
	 */
	async function getSession(id: string): Promise<void> {
		try {
			error.value = null;

			const response = await apiFetch<SessionResponse>(`/api/session/${id}`);

			sessionId.value = response.id;
			status.value = response.status;
			speakerMappings.value = response.speakerMappings || [];
		} catch (err) {
			error.value = err instanceof Error ? err : new Error(String(err));
		}
	}

	/**
	 * End the current session
	 */
	async function endSession(): Promise<void> {
		if (!sessionId.value) {
			return;
		}

		try {
			error.value = null;

			const response = await apiFetch<SessionResponse>(`/api/session/${sessionId.value}`, {
				method: 'DELETE',
			});

			status.value = response.status;
		} catch (err) {
			error.value = err instanceof Error ? err : new Error(String(err));
		}
	}

	/**
	 * Get speaker name by Azure speaker ID
	 */
	function getSpeakerName(speakerId: string): string {
		const mapping = speakerMappings.value.find((m) => m.azureSpeakerId === speakerId);
		return mapping?.displayName ?? 'Unknown';
	}

	/**
	 * Clear current error
	 */
	function clearError(): void {
		error.value = null;
	}

	return {
		// State
		sessionId,
		status,
		speakerMappings,
		error,
		registrationProgress,

		// Computed
		isActive,
		isRegistering,
		hasError,

		// Actions
		createSession,
		registerProfile,
		registerAllProfiles,
		getSession,
		endSession,
		getSpeakerName,
		clearError,
	};
}
