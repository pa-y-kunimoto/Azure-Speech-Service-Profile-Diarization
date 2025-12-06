/**
 * Unit tests for SessionControl component
 * TDD: Write tests first for session control UI
 *
 * Tests:
 * - Profile selection UI
 * - Session start/stop controls
 * - Speaker mapping display
 * - Loading and error states
 */

import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';

// Mock useDiarizationSession
const mockCreateSession = vi.fn();
const mockRegisterAllProfiles = vi.fn();
const mockEndSession = vi.fn();
const mockClearError = vi.fn();
const mockStatus = ref<string>('idle');
const mockSessionId = ref<string | null>(null);
const mockSpeakerMappings = ref<
	Array<{
		speakerId: string;
		profileId: string;
		profileName: string;
		isRegistered: boolean;
	}>
>([]);
const mockError = ref<Error | null>(null);
const mockRegistrationProgress = ref({ current: 0, total: 0 });

vi.mock('#imports', async () => {
	const actual = await vi.importActual('#imports');
	return {
		...actual,
		ref,
		computed,
	};
});

vi.mock('../../composables/useDiarizationSession', () => ({
	useDiarizationSession: () => ({
		createSession: mockCreateSession,
		registerAllProfiles: mockRegisterAllProfiles,
		endSession: mockEndSession,
		clearError: mockClearError,
		status: mockStatus,
		sessionId: mockSessionId,
		speakerMappings: mockSpeakerMappings,
		error: mockError,
		registrationProgress: mockRegistrationProgress,
		isActive: computed(() => mockStatus.value === 'active'),
		isRegistering: computed(() => mockStatus.value === 'registering'),
		hasError: computed(() => mockError.value !== null),
	}),
}));

// Mock useVoiceProfile
const mockProfiles = ref<
	Array<{
		id: string;
		name: string;
		audioBase64: string;
		createdAt: string;
		durationSeconds: number;
	}>
>([]);

vi.mock('../../composables/useVoiceProfile', () => ({
	useVoiceProfile: () => ({
		profiles: mockProfiles,
	}),
}));

// Import component after mocks
import SessionControl from '~/components/SessionControl.vue';

describe('SessionControl', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockStatus.value = 'idle';
		mockSessionId.value = null;
		mockSpeakerMappings.value = [];
		mockError.value = null;
		mockRegistrationProgress.value = { current: 0, total: 0 };
		mockProfiles.value = [];
	});

	describe('profile selection', () => {
		beforeEach(() => {
			mockProfiles.value = [
				{
					id: 'p1',
					name: '田中さん',
					audioBase64: 'audio1',
					createdAt: '2024-01-01',
					durationSeconds: 10,
				},
				{
					id: 'p2',
					name: '佐藤さん',
					audioBase64: 'audio2',
					createdAt: '2024-01-01',
					durationSeconds: 15,
				},
			];
		});

		it('should display available profiles as checkboxes', () => {
			const wrapper = mount(SessionControl);

			const checkboxes = wrapper.findAll('input[type="checkbox"]');
			expect(checkboxes).toHaveLength(2);
		});

		it('should show profile names next to checkboxes', () => {
			const wrapper = mount(SessionControl);

			expect(wrapper.text()).toContain('田中さん');
			expect(wrapper.text()).toContain('佐藤さん');
		});

		it('should allow selecting multiple profiles', async () => {
			const wrapper = mount(SessionControl);

			const checkboxes = wrapper.findAll('input[type="checkbox"]');
			await checkboxes[0]?.setValue(true);
			await checkboxes[1]?.setValue(true);

			expect((checkboxes[0]?.element as HTMLInputElement).checked).toBe(true);
			expect((checkboxes[1]?.element as HTMLInputElement).checked).toBe(true);
		});

		it('should disable start button when no profiles selected', () => {
			const wrapper = mount(SessionControl);

			const startButton = wrapper.find('[data-testid="start-session-btn"]');
			expect(startButton.attributes('disabled')).toBeDefined();
		});

		it('should enable start button when at least one profile selected', async () => {
			const wrapper = mount(SessionControl);

			const checkbox = wrapper.find('input[type="checkbox"]');
			await checkbox.setValue(true);

			const startButton = wrapper.find('[data-testid="start-session-btn"]');
			expect(startButton.attributes('disabled')).toBeUndefined();
		});

		it('should show message when no profiles available', () => {
			mockProfiles.value = [];
			const wrapper = mount(SessionControl);

			expect(wrapper.text()).toContain('プロフィールがありません');
		});
	});

	describe('session start', () => {
		beforeEach(() => {
			mockProfiles.value = [
				{
					id: 'p1',
					name: '田中さん',
					audioBase64: 'audio1',
					createdAt: '2024-01-01',
					durationSeconds: 10,
				},
			];
		});

		it('should create session with selected profiles on start', async () => {
			mockCreateSession.mockResolvedValueOnce(undefined);

			const wrapper = mount(SessionControl);

			// Select profile
			const checkbox = wrapper.find('input[type="checkbox"]');
			await checkbox.setValue(true);

			// Click start
			const startButton = wrapper.find('[data-testid="start-session-btn"]');
			await startButton.trigger('click');

			expect(mockCreateSession).toHaveBeenCalledWith(['p1']);
		});

		it('should register all selected profiles after session creation', async () => {
			mockCreateSession.mockResolvedValueOnce(undefined);
			mockRegisterAllProfiles.mockResolvedValueOnce(undefined);

			const wrapper = mount(SessionControl);

			const checkbox = wrapper.find('input[type="checkbox"]');
			await checkbox.setValue(true);

			const startButton = wrapper.find('[data-testid="start-session-btn"]');
			await startButton.trigger('click');

			expect(mockRegisterAllProfiles).toHaveBeenCalledWith([
				expect.objectContaining({
					id: 'p1',
					name: '田中さん',
					audioBase64: 'audio1',
				}),
			]);
		});

		it('should disable controls while connecting', async () => {
			mockStatus.value = 'connecting';

			const wrapper = mount(SessionControl);

			const checkboxes = wrapper.findAll('input[type="checkbox"]');
			for (const checkbox of checkboxes) {
				expect(checkbox.attributes('disabled')).toBeDefined();
			}
		});

		it('should show loading indicator while connecting', () => {
			mockStatus.value = 'connecting';

			const wrapper = mount(SessionControl);

			expect(wrapper.find('[data-testid="loading-indicator"]').exists()).toBe(true);
		});
	});

	describe('registration progress', () => {
		it('should show progress during profile registration', () => {
			mockStatus.value = 'registering';
			mockRegistrationProgress.value = { current: 1, total: 3 };

			const wrapper = mount(SessionControl);

			expect(wrapper.text()).toContain('1 / 3');
		});

		it('should show progress bar', () => {
			mockStatus.value = 'registering';
			mockRegistrationProgress.value = { current: 2, total: 4 };

			const wrapper = mount(SessionControl);

			const progressBar = wrapper.find('[data-testid="progress-bar"]');
			expect(progressBar.exists()).toBe(true);
		});
	});

	describe('speaker mapping display', () => {
		beforeEach(() => {
			mockStatus.value = 'active';
			mockSessionId.value = 'session-123';
			mockSpeakerMappings.value = [
				{ speakerId: 'Guest-1', profileId: 'p1', profileName: '田中さん', isRegistered: true },
				{ speakerId: 'Guest-2', profileId: 'p2', profileName: '佐藤さん', isRegistered: true },
			];
		});

		it('should display speaker mappings when session is active', () => {
			const wrapper = mount(SessionControl);

			expect(wrapper.text()).toContain('田中さん');
			expect(wrapper.text()).toContain('佐藤さん');
			expect(wrapper.text()).toContain('Guest-1');
			expect(wrapper.text()).toContain('Guest-2');
		});

		it('should show mapping table with headers', () => {
			const wrapper = mount(SessionControl);

			expect(wrapper.text()).toContain('話者名');
			expect(wrapper.text()).toContain('Speaker ID');
		});

		it('should show registration status indicator', () => {
			const wrapper = mount(SessionControl);

			const statusIndicators = wrapper.findAll('[data-testid="registration-status"]');
			expect(statusIndicators).toHaveLength(2);
		});
	});

	describe('session end', () => {
		beforeEach(() => {
			mockStatus.value = 'active';
			mockSessionId.value = 'session-123';
		});

		it('should show end session button when active', () => {
			const wrapper = mount(SessionControl);

			const endButton = wrapper.find('[data-testid="end-session-btn"]');
			expect(endButton.exists()).toBe(true);
		});

		it('should call endSession when end button clicked', async () => {
			const wrapper = mount(SessionControl);

			const endButton = wrapper.find('[data-testid="end-session-btn"]');
			await endButton.trigger('click');

			expect(mockEndSession).toHaveBeenCalled();
		});

		it('should hide start controls when session is active', () => {
			const wrapper = mount(SessionControl);

			const startButton = wrapper.find('[data-testid="start-session-btn"]');
			expect(startButton.exists()).toBe(false);
		});
	});

	describe('error handling', () => {
		it('should display error message', () => {
			mockError.value = new Error('接続エラーが発生しました');

			const wrapper = mount(SessionControl);

			expect(wrapper.text()).toContain('接続エラーが発生しました');
		});

		it('should show retry button on error', () => {
			mockError.value = new Error('Test error');

			const wrapper = mount(SessionControl);

			const retryButton = wrapper.find('[data-testid="retry-btn"]');
			expect(retryButton.exists()).toBe(true);
		});

		it('should clear error on retry', async () => {
			mockError.value = new Error('Test error');

			const wrapper = mount(SessionControl);

			const retryButton = wrapper.find('[data-testid="retry-btn"]');
			await retryButton.trigger('click');

			expect(mockClearError).toHaveBeenCalled();
		});

		it('should hide error when status changes', async () => {
			mockError.value = new Error('Test error');
			const wrapper = mount(SessionControl);

			expect(wrapper.text()).toContain('Test error');

			mockError.value = null;
			await wrapper.vm.$nextTick();

			expect(wrapper.text()).not.toContain('Test error');
		});
	});

	describe('session status display', () => {
		it('should show idle status badge', () => {
			mockStatus.value = 'idle';

			const wrapper = mount(SessionControl);

			expect(wrapper.find('[data-testid="status-badge"]').text()).toContain('待機中');
		});

		it('should show connecting status badge', () => {
			mockStatus.value = 'connecting';

			const wrapper = mount(SessionControl);

			expect(wrapper.find('[data-testid="status-badge"]').text()).toContain('接続中');
		});

		it('should show registering status badge', () => {
			mockStatus.value = 'registering';

			const wrapper = mount(SessionControl);

			expect(wrapper.find('[data-testid="status-badge"]').text()).toContain('登録中');
		});

		it('should show active status badge', () => {
			mockStatus.value = 'active';

			const wrapper = mount(SessionControl);

			expect(wrapper.find('[data-testid="status-badge"]').text()).toContain('アクティブ');
		});

		it('should show error status badge', () => {
			mockStatus.value = 'error';

			const wrapper = mount(SessionControl);

			expect(wrapper.find('[data-testid="status-badge"]').text()).toContain('エラー');
		});
	});
});
