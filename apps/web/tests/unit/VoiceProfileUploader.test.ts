/**
 * Unit tests for VoiceProfileUploader component
 * TDD: Write tests first, verify behavior
 */

import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VoiceProfileUploader from '../../components/VoiceProfileUploader.vue';

// Mock useVoiceProfile composable
const mockAddProfile = vi.fn();
vi.mock('~/composables/useVoiceProfile', () => ({
	useVoiceProfile: () => ({
		profiles: { value: [] },
		addProfile: mockAddProfile,
	}),
}));

// Mock audioConverter utilities
vi.mock('~/utils/audioConverter', () => ({
	convertAudioToBase64Wav: vi.fn().mockResolvedValue({
		success: true,
		audioBase64: 'base64audiodata',
	}),
	getAudioDuration: vi.fn().mockResolvedValue(10),
	isSupportedFormat: vi.fn().mockImplementation((mimeType: string) => {
		return (
			mimeType === 'audio/wav' ||
			mimeType === 'audio/wave' ||
			mimeType === 'audio/x-wav' ||
			mimeType === 'audio/mpeg' ||
			mimeType === 'audio/mp3'
		);
	}),
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();
globalThis.URL.createObjectURL = mockCreateObjectURL;
globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

describe('VoiceProfileUploader', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockAddProfile.mockReturnValue({
			success: true,
			profile: { id: 'test-id', name: 'Test Speaker' },
		});
	});

	describe('rendering', () => {
		it('should render name input field', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();
			const input = wrapper.find('input#speaker-name');
			expect(input.exists()).toBe(true);
			expect(input.attributes('placeholder')).toContain('田中太郎');
		});

		it('should render file upload area', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();
			const fileInput = wrapper.find('input[type="file"]');
			expect(fileInput.exists()).toBe(true);
			expect(fileInput.attributes('accept')).toContain('audio/wav');
			expect(fileInput.attributes('accept')).toContain('audio/mpeg');
		});

		it('should render submit button', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();
			const button = wrapper.find('button[type="button"]');
			expect(button.exists()).toBe(true);
			expect(button.text()).toContain('プロフィールを登録');
		});

		it('should show character count for name input', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();
			expect(wrapper.text()).toContain('/50 文字');
		});
	});

	describe('name input validation', () => {
		it('should update character count when typing', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();
			const input = wrapper.find('input#speaker-name');

			await input.setValue('テスト');
			expect(wrapper.text()).toContain('3/50 文字');
		});

		it('should show error when name is empty and blurred', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();
			const input = wrapper.find('input#speaker-name');

			// First enter something, then clear to trigger watcher
			await input.setValue('test');
			await wrapper.vm.$nextTick();
			await input.setValue('');
			// Wait for the watcher to trigger
			await wrapper.vm.$nextTick();
			await flushPromises();

			expect(wrapper.text()).toContain('話者名を入力してください');
		});

		it('should show error when name exceeds 50 characters', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();
			const input = wrapper.find('input#speaker-name');

			const longName = 'あ'.repeat(51);
			await input.setValue(longName);
			await wrapper.vm.$nextTick();

			expect(wrapper.text()).toContain('50文字以内');
		});
	});

	describe('file selection', () => {
		it('should accept WAV files', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();
			const fileInput = wrapper.find('input[type="file"]');

			const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);

			const inputEl = fileInput.element as HTMLInputElement;
			Object.defineProperty(inputEl, 'files', {
				value: dataTransfer.files,
				writable: true,
			});

			await fileInput.trigger('change');
			await wrapper.vm.$nextTick();

			// File should be accepted (no error message)
			expect(wrapper.text()).not.toContain('WAV または MP3 形式のファイルを選択してください');
		});

		it('should accept MP3 files', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();
			const fileInput = wrapper.find('input[type="file"]');

			const file = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);

			const inputEl = fileInput.element as HTMLInputElement;
			Object.defineProperty(inputEl, 'files', {
				value: dataTransfer.files,
				writable: true,
			});

			await fileInput.trigger('change');
			await wrapper.vm.$nextTick();

			expect(wrapper.text()).not.toContain('WAV または MP3 形式のファイルを選択してください');
		});

		it('should show selected file name after selection', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();
			const fileInput = wrapper.find('input[type="file"]');

			const file = new File(['audio data'], 'my-audio.wav', { type: 'audio/wav' });
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);

			const inputEl = fileInput.element as HTMLInputElement;
			Object.defineProperty(inputEl, 'files', {
				value: dataTransfer.files,
				writable: true,
			});

			await fileInput.trigger('change');
			await wrapper.vm.$nextTick();
			await flushPromises();

			expect(wrapper.text()).toContain('my-audio.wav');
		});
	});

	describe('submit button state', () => {
		it('should be disabled initially', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();
			const button = wrapper.find('button[type="button"]');
			expect(button.attributes('disabled')).toBeDefined();
		});

		it('should remain disabled if only name is entered', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();
			const input = wrapper.find('input#speaker-name');
			await input.setValue('Test Speaker');

			const button = wrapper.find('button[type="button"]');
			expect(button.attributes('disabled')).toBeDefined();
		});
	});

	describe('form submission', () => {
		// Helper function to wait for async processFile to complete
		async function waitForFileProcessing(wrapper: ReturnType<typeof mount>) {
			// Wait for the async processFile function to complete
			// Check if selectedFile is set and audioDuration is populated
			for (let i = 0; i < 20; i++) {
				await flushPromises();
				await wrapper.vm.$nextTick();
				// Check if component shows file info (indicates processing complete)
				if (wrapper.text().includes('test.wav')) {
					// Additional wait for audioDuration to be set
					await flushPromises();
					await wrapper.vm.$nextTick();
					return true;
				}
				await new Promise((r) => setTimeout(r, 50));
			}
			return false;
		}

		it('should emit profileAdded event on successful submission', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();

			// Set name
			const nameInput = wrapper.find('input#speaker-name');
			await nameInput.setValue('Test Speaker');
			await flushPromises();

			// Simulate file selection with valid duration
			const fileInput = wrapper.find('input[type="file"]');
			const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);

			const inputEl = fileInput.element as HTMLInputElement;
			Object.defineProperty(inputEl, 'files', {
				value: dataTransfer.files,
				writable: true,
			});

			await fileInput.trigger('change');
			// Wait for processFile async function to complete
			await waitForFileProcessing(wrapper);

			// Verify file is displayed (confirms processFile completed)
			expect(wrapper.text()).toContain('test.wav');

			// Find submit button by text content
			const allButtons = wrapper.findAll('button');
			const submitButton = allButtons.find((btn) => btn.text().includes('プロフィールを登録'));
			expect(submitButton).toBeDefined();

			// Submit
			await submitButton?.trigger('click');
			await flushPromises();
			await wrapper.vm.$nextTick();
			await flushPromises();

			// Check emitted events
			const emitted = wrapper.emitted('profileAdded');
			expect(emitted).toBeTruthy();
		});

		it('should call addProfile with correct data', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();

			// Set name
			const nameInput = wrapper.find('input#speaker-name');
			await nameInput.setValue('Test Speaker');
			await flushPromises();

			// Simulate file selection
			const fileInput = wrapper.find('input[type="file"]');
			const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);

			const inputEl = fileInput.element as HTMLInputElement;
			Object.defineProperty(inputEl, 'files', {
				value: dataTransfer.files,
				writable: true,
			});

			await fileInput.trigger('change');
			// Wait for processFile async function to complete
			await waitForFileProcessing(wrapper);

			// Find submit button by text content
			const allButtons = wrapper.findAll('button');
			const submitButton = allButtons.find((btn) => btn.text().includes('プロフィールを登録'));
			expect(submitButton).toBeDefined();

			// Submit
			await submitButton?.trigger('click');
			await flushPromises();
			await wrapper.vm.$nextTick();
			await flushPromises();

			expect(mockAddProfile).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'Test Speaker',
					source: 'upload',
				})
			);
		});

		it('should show error message on failed submission', async () => {
			mockAddProfile.mockReturnValue({
				success: false,
				errors: [{ field: 'name', message: 'Invalid name' }],
			});

			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();

			// Set name
			const nameInput = wrapper.find('input#speaker-name');
			await nameInput.setValue('Test');
			await flushPromises();

			// Simulate file selection
			const fileInput = wrapper.find('input[type="file"]');
			const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);

			const inputEl = fileInput.element as HTMLInputElement;
			Object.defineProperty(inputEl, 'files', {
				value: dataTransfer.files,
				writable: true,
			});

			await fileInput.trigger('change');
			// Wait for processFile async function to complete
			await waitForFileProcessing(wrapper);

			// Find submit button by text content
			const allButtons = wrapper.findAll('button');
			const submitButton = allButtons.find((btn) => btn.text().includes('プロフィールを登録'));
			expect(submitButton).toBeDefined();

			// Submit
			await submitButton?.trigger('click');
			await flushPromises();
			await wrapper.vm.$nextTick();
			await flushPromises();

			expect(wrapper.text()).toContain('Invalid name');
		});
	});

	describe('audio preview', () => {
		it('should show audio preview after file selection', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();
			const fileInput = wrapper.find('input[type="file"]');

			const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);

			const inputEl = fileInput.element as HTMLInputElement;
			Object.defineProperty(inputEl, 'files', {
				value: dataTransfer.files,
				writable: true,
			});

			await fileInput.trigger('change');
			await wrapper.vm.$nextTick();
			await flushPromises();

			const audioElement = wrapper.find('audio');
			expect(audioElement.exists()).toBe(true);
		});
	});

	describe('drag and drop', () => {
		it('should handle drag over state', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();
			const dropZone = wrapper.find('.border-dashed');

			await dropZone.trigger('dragover');
			expect(dropZone.classes()).toContain('border-blue-500');
		});

		it('should reset drag state on drag leave', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();
			const dropZone = wrapper.find('.border-dashed');

			await dropZone.trigger('dragover');
			await dropZone.trigger('dragleave');
			expect(dropZone.classes()).not.toContain('border-blue-500');
		});
	});

	describe('file removal', () => {
		it('should clear file when clear button is clicked', async () => {
			const wrapper = mount(VoiceProfileUploader);
			await flushPromises();
			const fileInput = wrapper.find('input[type="file"]');

			// First, add a file
			const file = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);

			const inputEl = fileInput.element as HTMLInputElement;
			Object.defineProperty(inputEl, 'files', {
				value: dataTransfer.files,
				writable: true,
			});

			await fileInput.trigger('change');
			await wrapper.vm.$nextTick();
			await flushPromises();

			// Find and click clear button (the X button next to file info)
			const clearButtons = wrapper.findAll('button[type="button"]');
			const clearButton = clearButtons.find((btn) =>
				btn.find('svg path[d*="M6 18L18 6"]').exists()
			);
			if (clearButton) {
				await clearButton.trigger('click');
				await wrapper.vm.$nextTick();

				expect(wrapper.text()).not.toContain('test.wav');
			}
		});
	});
});
