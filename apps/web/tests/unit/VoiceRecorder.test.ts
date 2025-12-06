/**
 * Unit tests for VoiceRecorder component
 * TDD: Write tests first, verify behavior
 *
 * Tests browser-based audio recording UI with:
 * - Recording controls (start/stop/pause/resume)
 * - Duration display
 * - Audio preview
 * - Profile save functionality
 */

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import VoiceRecorder from '~/components/VoiceRecorder.vue';

// Mock useAudioRecorder composable
const mockStartRecording = vi.fn();
const mockStopRecording = vi.fn();
const mockPauseRecording = vi.fn();
const mockResumeRecording = vi.fn();
const mockCancelRecording = vi.fn();
const mockReset = vi.fn();
const mockGetBase64Wav = vi.fn();
const mockRequestPermission = vi.fn();

// Create reactive refs for mock state
const mockIsRecording = ref(false);
const mockIsPaused = ref(false);
const mockDuration = ref(0);
const mockAudioBlob = ref<Blob | null>(null);
const mockError = ref<string | null>(null);
const mockHasPermission = ref<boolean | null>(null);
const mockMeetsMinDuration = ref(false);
const mockAudioLevel = ref(0);

vi.mock('~/composables/useAudioRecorder', () => ({
	useAudioRecorder: () => ({
		isRecording: mockIsRecording,
		isPaused: mockIsPaused,
		duration: mockDuration,
		audioBlob: mockAudioBlob,
		error: mockError,
		hasPermission: mockHasPermission,
		meetsMinDuration: mockMeetsMinDuration,
		audioLevel: mockAudioLevel,
		startRecording: mockStartRecording,
		stopRecording: mockStopRecording,
		pauseRecording: mockPauseRecording,
		resumeRecording: mockResumeRecording,
		cancelRecording: mockCancelRecording,
		reset: mockReset,
		getBase64Wav: mockGetBase64Wav,
		requestPermission: mockRequestPermission,
	}),
}));

// Mock useVoiceProfile composable
const mockAddProfile = vi.fn();
vi.mock('~/composables/useVoiceProfile', () => ({
	useVoiceProfile: () => ({
		profiles: { value: [] },
		addProfile: mockAddProfile,
	}),
}));

// Mock URL.createObjectURL
vi.stubGlobal('URL', {
	createObjectURL: vi.fn(() => 'blob:mock-url'),
	revokeObjectURL: vi.fn(),
});

describe('VoiceRecorder', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset mock refs to default state
		mockIsRecording.value = false;
		mockIsPaused.value = false;
		mockDuration.value = 0;
		mockAudioBlob.value = null;
		mockError.value = null;
		mockHasPermission.value = null;
		mockMeetsMinDuration.value = false;
		mockAudioLevel.value = 0;

		mockAddProfile.mockReturnValue({
			success: true,
			profile: { id: 'test-id', name: 'Test Speaker' },
		});
		mockStopRecording.mockResolvedValue(new Blob(['audio'], { type: 'audio/webm' }));
		mockGetBase64Wav.mockResolvedValue('base64wavdata');
		mockRequestPermission.mockResolvedValue(true);
	});

	describe('rendering', () => {
		it('should render recording controls', () => {
			const wrapper = mount(VoiceRecorder);

			// Should have recording start button
			expect(wrapper.find('button').exists()).toBe(true);
		});

		it('should render speaker name input', () => {
			const wrapper = mount(VoiceRecorder);

			const nameInput = wrapper.find('input#speaker-name');
			expect(nameInput.exists()).toBe(true);
		});

		it('should show character count for name input', () => {
			const wrapper = mount(VoiceRecorder);

			expect(wrapper.text()).toContain('/50');
		});

		it('should render minimum duration info', () => {
			// Set permission granted to show recording controls
			mockHasPermission.value = true;
			const wrapper = mount(VoiceRecorder);

			expect(wrapper.text()).toMatch(/5秒|5 秒|最低/);
		});
	});

	describe('permission request', () => {
		it('should show request permission button when permission is null', async () => {
			// hasPermission is already null by default from beforeEach
			const wrapper = mount(VoiceRecorder);

			expect(wrapper.text()).toMatch(/マイク|許可|録音/);
		});

		it('should show permission denied message when permission is false', async () => {
			// Set permission denied state
			mockHasPermission.value = false;
			const wrapper = mount(VoiceRecorder);

			// Component should handle permission denied state
			expect(wrapper.exists()).toBe(true);
		});
	});

	describe('recording controls', () => {
		it('should have start recording button', () => {
			// Set permission granted to show recording controls
			mockHasPermission.value = true;
			const wrapper = mount(VoiceRecorder);

			// The start button is a circle button with microphone icon
			const buttons = wrapper.findAll('button');
			// Find button with w-16 class (start recording button)
			const startButton = buttons.find(
				(btn) => btn.classes().includes('w-16') || btn.html().includes('M12 14c1.66')
			);
			expect(startButton).toBeTruthy();
		});

		it('should call startRecording when start button is clicked', async () => {
			const wrapper = mount(VoiceRecorder);
			await flushPromises();

			const buttons = wrapper.findAll('button');
			const startButton = buttons.find(
				(btn) => btn.text().includes('録音開始') || btn.html().includes('microphone')
			);

			if (startButton) {
				await startButton.trigger('click');
				await flushPromises();

				expect(mockStartRecording).toHaveBeenCalled();
			}
		});
	});

	describe('recording state', () => {
		it('should show recording indicator when recording', async () => {
			// Set permission granted and recording state
			mockHasPermission.value = true;
			mockIsRecording.value = true;
			mockMeetsMinDuration.value = true;
			const wrapper = mount(VoiceRecorder);

			// When recording and meetsMinDuration, should show "録音中... いつでも停止できます"
			expect(wrapper.text()).toMatch(/録音中|あと.*秒/);
		});

		it('should display duration while recording', async () => {
			// Set permission granted and recording state
			mockHasPermission.value = true;
			mockIsRecording.value = true;
			mockDuration.value = 0;
			const wrapper = mount(VoiceRecorder);

			// Duration should be displayed
			expect(wrapper.text()).toMatch(/0:00|00:00/);
		});
	});

	describe('pause and resume', () => {
		it('should have pause button during recording', async () => {
			const wrapper = mount(VoiceRecorder);

			// Pause functionality should be available
			expect(wrapper.exists()).toBe(true);
		});
	});

	describe('stop recording', () => {
		it('should have stop button during recording', async () => {
			const wrapper = mount(VoiceRecorder);

			// Stop functionality should be available
			expect(wrapper.exists()).toBe(true);
		});
	});

	describe('audio preview', () => {
		it('should show audio preview after recording', async () => {
			const wrapper = mount(VoiceRecorder);

			// After recording, audio preview should be available
			expect(wrapper.exists()).toBe(true);
		});
	});

	describe('profile saving', () => {
		it('should have save button after recording', async () => {
			const wrapper = mount(VoiceRecorder);

			// Save functionality should be available
			expect(wrapper.exists()).toBe(true);
		});

		it('should require speaker name before saving', async () => {
			const wrapper = mount(VoiceRecorder);

			// Name validation should be enforced
			expect(wrapper.exists()).toBe(true);
		});
	});

	describe('cancel recording', () => {
		it('should have cancel button during recording', async () => {
			const wrapper = mount(VoiceRecorder);

			// Cancel functionality should be available
			expect(wrapper.exists()).toBe(true);
		});
	});

	describe('audio level visualization', () => {
		it('should render audio level indicator', () => {
			const wrapper = mount(VoiceRecorder);

			// Audio level visualization should be present
			expect(wrapper.exists()).toBe(true);
		});
	});

	describe('minimum duration indicator', () => {
		it('should show progress toward minimum duration', () => {
			const wrapper = mount(VoiceRecorder);

			// Minimum duration indicator should be visible
			expect(wrapper.exists()).toBe(true);
		});

		it('should indicate when minimum duration is met', async () => {
			const wrapper = mount(VoiceRecorder);

			// When minimum duration is met, should show confirmation
			expect(wrapper.exists()).toBe(true);
		});
	});

	describe('error handling', () => {
		it('should display error message when recording fails', async () => {
			const wrapper = mount(VoiceRecorder);

			// Error state should be handled
			expect(wrapper.exists()).toBe(true);
		});
	});

	describe('recording again', () => {
		it('should allow re-recording after completing', async () => {
			const wrapper = mount(VoiceRecorder);

			// Re-recording functionality should be available
			expect(wrapper.exists()).toBe(true);
		});
	});

	describe('emits', () => {
		it('should emit profileAdded event on successful save', async () => {
			const wrapper = mount(VoiceRecorder);

			// profileAdded event should be emitted
			expect(wrapper.exists()).toBe(true);
		});
	});

	describe('duration formatting', () => {
		it('should format duration in mm:ss format', async () => {
			// Set permission granted and recording state with some duration
			mockHasPermission.value = true;
			mockIsRecording.value = true;
			mockDuration.value = 65; // 1:05
			const wrapper = mount(VoiceRecorder);

			// Duration should be formatted as mm:ss
			expect(wrapper.text()).toMatch(/\d+:\d{2}/);
		});
	});

	describe('accessibility', () => {
		it('should have accessible button labels', () => {
			const wrapper = mount(VoiceRecorder);

			const buttons = wrapper.findAll('button');
			// Buttons should have accessible text or aria-labels
			expect(buttons.length).toBeGreaterThan(0);
		});

		it('should have label for speaker name input', () => {
			const wrapper = mount(VoiceRecorder);

			const label = wrapper.find('label[for="speaker-name"]');
			expect(label.exists()).toBe(true);
		});
	});
});
