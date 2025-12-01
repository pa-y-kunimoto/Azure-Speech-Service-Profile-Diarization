/**
 * Composable for managing voice profiles in sessionStorage
 * @see data-model.md - VoiceProfile
 */

import type {
	CreateVoiceProfileInput,
	VoiceProfile,
	VoiceProfileValidationResult,
} from '@speaker-diarization/core';
import { validateVoiceProfile } from '@speaker-diarization/core';
import { computed, ref } from 'vue';

const STORAGE_KEY = 'voice-profiles';
// sessionStorage limit is typically ~5MB, warn at 80%
const STORAGE_WARNING_THRESHOLD = 0.8;
const ESTIMATED_STORAGE_LIMIT = 5 * 1024 * 1024; // 5MB

/**
 * Result of adding a profile
 */
interface AddProfileResult {
	success: boolean;
	profile?: VoiceProfile;
	errors?: VoiceProfileValidationResult['errors'];
}

/**
 * Storage information
 */
interface StorageInfo {
	usedBytes: number;
	estimatedLimit: number;
	usagePercentage: number;
	isNearLimit: boolean;
}

// Shared state across all uses of this composable
const profiles = ref<VoiceProfile[]>([]);
const isLoaded = ref(false);

/**
 * Generate a UUID v4
 */
function generateId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	// Fallback for environments without crypto.randomUUID
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Calculate storage usage
 */
function calculateStorageUsage(): StorageInfo {
	try {
		const data = sessionStorage.getItem(STORAGE_KEY) ?? '';
		const usedBytes = new Blob([data]).size;
		const usagePercentage = usedBytes / ESTIMATED_STORAGE_LIMIT;
		return {
			usedBytes,
			estimatedLimit: ESTIMATED_STORAGE_LIMIT,
			usagePercentage,
			isNearLimit: usagePercentage >= STORAGE_WARNING_THRESHOLD,
		};
	} catch {
		return {
			usedBytes: 0,
			estimatedLimit: ESTIMATED_STORAGE_LIMIT,
			usagePercentage: 0,
			isNearLimit: false,
		};
	}
}

/**
 * Load profiles from sessionStorage
 */
function loadProfiles(): void {
	if (typeof sessionStorage === 'undefined') return;

	try {
		const stored = sessionStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			if (Array.isArray(parsed)) {
				profiles.value = parsed;
			}
		}
	} catch (e) {
		console.error('Failed to load voice profiles from sessionStorage:', e);
		profiles.value = [];
	}
	isLoaded.value = true;
}

/**
 * Save profiles to sessionStorage
 */
function saveProfiles(): void {
	if (typeof sessionStorage === 'undefined') return;

	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profiles.value));
	} catch (e) {
		console.error('Failed to save voice profiles to sessionStorage:', e);
		// Could be quota exceeded - handle gracefully
	}
}

/**
 * Composable for managing voice profiles
 */
export function useVoiceProfile() {
	// Load profiles on first use
	if (!isLoaded.value) {
		loadProfiles();
	}

	const storageInfo = computed<StorageInfo>(() => calculateStorageUsage());

	/**
	 * Add a new voice profile
	 */
	function addProfile(input: CreateVoiceProfileInput): AddProfileResult {
		// Validate input
		const validation = validateVoiceProfile(input);
		if (!validation.valid) {
			return {
				success: false,
				errors: validation.errors,
			};
		}

		// Create new profile
		const newProfile: VoiceProfile = {
			id: generateId(),
			name: input.name,
			audioBase64: input.audioBase64,
			durationSeconds: input.durationSeconds,
			source: input.source,
			createdAt: new Date().toISOString(),
		};

		// Add to array and persist
		profiles.value = [...profiles.value, newProfile];
		saveProfiles();

		return {
			success: true,
			profile: newProfile,
		};
	}

	/**
	 * Remove a profile by ID
	 */
	function removeProfile(id: string): boolean {
		const initialLength = profiles.value.length;
		profiles.value = profiles.value.filter((p) => p.id !== id);

		if (profiles.value.length !== initialLength) {
			saveProfiles();
			return true;
		}
		return false;
	}

	/**
	 * Get a profile by ID
	 */
	function getProfileById(id: string): VoiceProfile | undefined {
		return profiles.value.find((p) => p.id === id);
	}

	/**
	 * Clear all profiles
	 */
	function clearAllProfiles(): void {
		profiles.value = [];
		saveProfiles();
	}

	/**
	 * Update a profile
	 */
	function updateProfile(id: string, updates: Partial<Pick<VoiceProfile, 'name'>>): boolean {
		const index = profiles.value.findIndex((p) => p.id === id);
		if (index === -1) return false;

		const profile = profiles.value[index];
		if (profile) {
			profiles.value[index] = { ...profile, ...updates };
			saveProfiles();
			return true;
		}
		return false;
	}

	return {
		// State
		profiles: computed(() => profiles.value),
		storageInfo,
		isLoaded: computed(() => isLoaded.value),

		// Actions
		addProfile,
		removeProfile,
		getProfileById,
		clearAllProfiles,
		updateProfile,
		reloadProfiles: loadProfiles,
	};
}
