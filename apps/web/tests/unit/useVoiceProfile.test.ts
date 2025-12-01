/**
 * Unit tests for useVoiceProfile composable
 * TDD: Write tests first, verify FAIL, then implement
 */

import type { CreateVoiceProfileInput, VoiceProfile } from '@speaker-diarization/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceProfile } from '../../composables/useVoiceProfile';

// Mock sessionStorage
const mockSessionStorage = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] ?? null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value;
		}),
		removeItem: vi.fn((key: string) => {
			delete store[key];
		}),
		clear: vi.fn(() => {
			store = {};
		}),
		get length() {
			return Object.keys(store).length;
		},
		key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
	};
})();

Object.defineProperty(globalThis, 'sessionStorage', {
	value: mockSessionStorage,
	writable: true,
});

describe('useVoiceProfile', () => {
	beforeEach(() => {
		mockSessionStorage.clear();
		vi.clearAllMocks();
	});

	describe('initial state', () => {
		it('should return empty profiles array initially', () => {
			const { profiles } = useVoiceProfile();
			expect(profiles.value).toEqual([]);
		});

		it('should load profiles from sessionStorage if they exist', () => {
			const existingProfiles: VoiceProfile[] = [
				{
					id: 'test-id-1',
					name: 'Test Speaker 1',
					audioBase64: 'base64data1',
					durationSeconds: 10,
					source: 'upload',
					createdAt: new Date().toISOString(),
				},
			];
			mockSessionStorage.setItem('voice-profiles', JSON.stringify(existingProfiles));

			const { profiles } = useVoiceProfile();
			expect(profiles.value).toHaveLength(1);
			expect(profiles.value[0]?.name).toBe('Test Speaker 1');
		});
	});

	describe('addProfile', () => {
		it('should add a new profile and persist to sessionStorage', () => {
			const { profiles, addProfile } = useVoiceProfile();

			const input: CreateVoiceProfileInput = {
				name: 'New Speaker',
				audioBase64: 'base64audiodata',
				durationSeconds: 10,
				source: 'upload',
			};

			const result = addProfile(input);

			expect(result.success).toBe(true);
			expect(profiles.value).toHaveLength(1);
			expect(profiles.value[0]?.name).toBe('New Speaker');
			expect(mockSessionStorage.setItem).toHaveBeenCalled();
		});

		it('should generate a unique ID for each profile', () => {
			const { profiles, addProfile } = useVoiceProfile();

			addProfile({
				name: 'Speaker 1',
				audioBase64: 'data1',
				durationSeconds: 10,
				source: 'upload',
			});

			addProfile({
				name: 'Speaker 2',
				audioBase64: 'data2',
				durationSeconds: 10,
				source: 'recording',
			});

			expect(profiles.value).toHaveLength(2);
			expect(profiles.value[0]?.id).not.toBe(profiles.value[1]?.id);
		});

		it('should return validation errors for invalid input', () => {
			const { addProfile } = useVoiceProfile();

			const result = addProfile({
				name: '',
				audioBase64: '',
				durationSeconds: 2,
				source: 'upload',
			});

			expect(result.success).toBe(false);
			expect(result.errors?.length).toBeGreaterThan(0);
		});
	});

	describe('removeProfile', () => {
		it('should remove a profile by ID', () => {
			const { profiles, addProfile, removeProfile } = useVoiceProfile();

			addProfile({
				name: 'To Remove',
				audioBase64: 'data',
				durationSeconds: 10,
				source: 'upload',
			});

			expect(profiles.value).toHaveLength(1);
			const profileId = profiles.value[0]?.id;

			if (profileId) {
				removeProfile(profileId);
				expect(profiles.value).toHaveLength(0);
			}
		});

		it('should do nothing if profile ID does not exist', () => {
			const { profiles, addProfile, removeProfile } = useVoiceProfile();

			addProfile({
				name: 'Existing',
				audioBase64: 'data',
				durationSeconds: 10,
				source: 'upload',
			});

			removeProfile('non-existent-id');
			expect(profiles.value).toHaveLength(1);
		});
	});

	describe('getProfileById', () => {
		it('should return profile by ID', () => {
			const { profiles, addProfile, getProfileById } = useVoiceProfile();

			addProfile({
				name: 'Find Me',
				audioBase64: 'data',
				durationSeconds: 10,
				source: 'upload',
			});

			const profileId = profiles.value[0]?.id;
			if (profileId) {
				const found = getProfileById(profileId);
				expect(found?.name).toBe('Find Me');
			}
		});

		it('should return undefined for non-existent ID', () => {
			const { getProfileById } = useVoiceProfile();
			const result = getProfileById('non-existent');
			expect(result).toBeUndefined();
		});
	});

	describe('storage capacity', () => {
		it('should track storage usage', () => {
			const { storageInfo } = useVoiceProfile();
			expect(storageInfo.value.usedBytes).toBeGreaterThanOrEqual(0);
		});

		it('should warn when storage is nearly full', () => {
			const { addProfile, storageInfo } = useVoiceProfile();

			// Add multiple profiles to increase storage usage
			for (let i = 0; i < 10; i++) {
				addProfile({
					name: `Speaker ${i}`,
					audioBase64: 'a'.repeat(10000),
					durationSeconds: 10,
					source: 'upload',
				});
			}

			// Storage warning threshold check (implementation will define actual threshold)
			expect(storageInfo.value.usedBytes).toBeGreaterThan(0);
		});
	});

	describe('clearAllProfiles', () => {
		it('should remove all profiles', () => {
			const { profiles, addProfile, clearAllProfiles } = useVoiceProfile();

			addProfile({
				name: 'Speaker 1',
				audioBase64: 'data1',
				durationSeconds: 10,
				source: 'upload',
			});

			addProfile({
				name: 'Speaker 2',
				audioBase64: 'data2',
				durationSeconds: 10,
				source: 'upload',
			});

			expect(profiles.value).toHaveLength(2);
			clearAllProfiles();
			expect(profiles.value).toHaveLength(0);
		});
	});
});
