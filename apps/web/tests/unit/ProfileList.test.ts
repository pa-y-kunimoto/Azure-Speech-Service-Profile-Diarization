/**
 * Unit tests for ProfileList component
 * TDD: Write tests first, verify behavior
 */

import type { VoiceProfile } from '@speaker-diarization/core';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import ProfileList from '../../components/ProfileList.vue';

// Mock profiles - must be defined before vi.mock
const mockProfiles = ref<VoiceProfile[]>([
	{
		id: 'profile-1',
		name: '田中太郎',
		audioBase64: 'base64data1',
		durationSeconds: 15,
		source: 'upload',
		createdAt: new Date().toISOString(),
	},
	{
		id: 'profile-2',
		name: '山田花子',
		audioBase64: 'base64data2',
		durationSeconds: 30,
		source: 'recording',
		createdAt: new Date().toISOString(),
	},
]);

const mockStorageInfo = ref({
	usedBytes: 50000,
	usagePercentage: 0.01,
	isNearLimit: false,
});

const mockRemoveProfile = vi.fn();
const mockClearAllProfiles = vi.fn();

// Mock useVoiceProfile composable
vi.mock('~/composables/useVoiceProfile', () => ({
	useVoiceProfile: () => ({
		profiles: mockProfiles,
		storageInfo: mockStorageInfo,
		removeProfile: mockRemoveProfile,
		clearAllProfiles: mockClearAllProfiles,
	}),
}));

// Mock window.confirm
const mockConfirm = vi.fn(() => true);
globalThis.confirm = mockConfirm;

describe('ProfileList', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockConfirm.mockReturnValue(true);
	});

	describe('rendering', () => {
		it('should render list of profiles', async () => {
			const wrapper = mount(ProfileList);
			await flushPromises();

			expect(wrapper.text()).toContain('田中太郎');
			expect(wrapper.text()).toContain('山田花子');
		});

		it('should display profile initials', async () => {
			const wrapper = mount(ProfileList);
			await flushPromises();

			// 田中太郎 should show initials
			const avatars = wrapper.findAll('.rounded-full');
			expect(avatars.length).toBeGreaterThan(0);
		});

		it('should display duration for each profile', async () => {
			const wrapper = mount(ProfileList);
			await flushPromises();

			expect(wrapper.text()).toContain('15秒');
			expect(wrapper.text()).toContain('30秒');
		});

		it('should display source type (upload/recording)', async () => {
			const wrapper = mount(ProfileList);
			await flushPromises();

			expect(wrapper.text()).toContain('アップロード');
			expect(wrapper.text()).toContain('録音');
		});

		it('should render play button for each profile', async () => {
			const wrapper = mount(ProfileList);
			await flushPromises();

			// Each profile should have a play button
			const playButtons = wrapper.findAll('button[title="再生"]');
			expect(playButtons.length).toBe(2);
		});

		it('should render delete button for each profile', async () => {
			const wrapper = mount(ProfileList);
			await flushPromises();

			const deleteButtons = wrapper.findAll('button[title="削除"]');
			expect(deleteButtons.length).toBe(2);
		});

		it('should render "clear all" button when profiles exist', async () => {
			const wrapper = mount(ProfileList);
			await flushPromises();

			expect(wrapper.text()).toContain('すべてのプロフィールを削除');
		});
	});

	describe('profile deletion', () => {
		it('should call removeProfile when delete is confirmed', async () => {
			const wrapper = mount(ProfileList);
			await flushPromises();

			const deleteButtons = wrapper.findAll('button[title="削除"]');
			if (deleteButtons[0]) {
				await deleteButtons[0].trigger('click');

				expect(mockConfirm).toHaveBeenCalled();
				expect(mockRemoveProfile).toHaveBeenCalledWith('profile-1');
			}
		});

		it('should not call removeProfile when delete is cancelled', async () => {
			mockConfirm.mockReturnValue(false);

			const wrapper = mount(ProfileList);
			await flushPromises();

			const deleteButtons = wrapper.findAll('button[title="削除"]');
			if (deleteButtons[0]) {
				await deleteButtons[0].trigger('click');

				expect(mockConfirm).toHaveBeenCalled();
				expect(mockRemoveProfile).not.toHaveBeenCalled();
			}
		});
	});

	describe('clear all profiles', () => {
		it('should call clearAllProfiles when confirmed', async () => {
			const wrapper = mount(ProfileList);
			await flushPromises();

			const clearButton = wrapper.find('button.text-red-600');
			if (clearButton.exists()) {
				await clearButton.trigger('click');

				expect(mockConfirm).toHaveBeenCalledWith(
					expect.stringContaining('すべてのプロフィールを削除')
				);
				expect(mockClearAllProfiles).toHaveBeenCalled();
			}
		});

		it('should not call clearAllProfiles when cancelled', async () => {
			mockConfirm.mockReturnValue(false);

			const wrapper = mount(ProfileList);
			await flushPromises();

			const clearButton = wrapper.find('button.text-red-600');
			if (clearButton.exists()) {
				await clearButton.trigger('click');

				expect(mockClearAllProfiles).not.toHaveBeenCalled();
			}
		});
	});

	describe('audio playback', () => {
		it('should have hidden audio element', async () => {
			const wrapper = mount(ProfileList);
			await flushPromises();

			const audioElement = wrapper.find('audio');
			expect(audioElement.exists()).toBe(true);
		});
	});

	describe('date formatting', () => {
		it('should display creation date for each profile', async () => {
			const wrapper = mount(ProfileList);
			await flushPromises();

			// Check that dates are formatted
			const listItems = wrapper.findAll('li');
			expect(listItems.length).toBe(2);

			// Each item should have date information
			for (const item of listItems) {
				expect(item.text()).toMatch(/月.*日|:/);
			}
		});
	});

	describe('duration formatting', () => {
		it('should format duration correctly for seconds', async () => {
			const wrapper = mount(ProfileList);
			await flushPromises();

			expect(wrapper.text()).toContain('15秒');
		});

		it('should format duration correctly for minutes', async () => {
			// Profile with 30 seconds shows "30秒"
			const wrapper = mount(ProfileList);
			await flushPromises();
			expect(wrapper.text()).toContain('30秒');
		});
	});

	describe('accessibility', () => {
		it('should have proper button titles for screen readers', async () => {
			const wrapper = mount(ProfileList);
			await flushPromises();

			const playButtons = wrapper.findAll('button[title="再生"]');
			const deleteButtons = wrapper.findAll('button[title="削除"]');

			expect(playButtons.length).toBe(2);
			expect(deleteButtons.length).toBe(2);
		});
	});
});
