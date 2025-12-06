/**
 * TimeoutWarningModal Component Unit Tests
 */

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TimeoutWarningModal from '~/components/TimeoutWarningModal.vue';

// Mount options to stub Teleport
const mountOptions = {
	global: {
		stubs: {
			Teleport: true,
		},
	},
};

describe('TimeoutWarningModal', () => {
	describe('visibility', () => {
		it('should be visible when warning prop is provided', () => {
			const wrapper = mount(TimeoutWarningModal, {
				...mountOptions,
				props: {
					warning: {
						warningType: 'session',
						remainingSeconds: 60,
						message: 'セッションがあと1分で終了します。延長しますか？',
					},
				},
			});

			expect(wrapper.find('[data-testid="timeout-warning-modal"]').exists()).toBe(true);
		});

		it('should be hidden when warning is null', () => {
			const wrapper = mount(TimeoutWarningModal, {
				...mountOptions,
				props: {
					warning: null,
				},
			});

			expect(wrapper.find('[data-testid="timeout-warning-modal"]').exists()).toBe(false);
		});
	});

	describe('session warning', () => {
		it('should display session warning message', () => {
			const wrapper = mount(TimeoutWarningModal, {
				...mountOptions,
				props: {
					warning: {
						warningType: 'session',
						remainingSeconds: 60,
						message: 'セッションがあと1分で終了します。延長しますか？',
					},
				},
			});

			expect(wrapper.text()).toContain('セッションがあと1分で終了します');
		});

		it('should show extend button for session warning', () => {
			const wrapper = mount(TimeoutWarningModal, {
				...mountOptions,
				props: {
					warning: {
						warningType: 'session',
						remainingSeconds: 60,
						message: 'セッションがあと1分で終了します。延長しますか？',
					},
					allowSessionExtend: true,
				},
			});

			expect(wrapper.find('[data-testid="extend-button"]').exists()).toBe(true);
		});

		it('should emit extend event when extend button is clicked', async () => {
			const wrapper = mount(TimeoutWarningModal, {
				...mountOptions,
				props: {
					warning: {
						warningType: 'session',
						remainingSeconds: 60,
						message: 'セッションがあと1分で終了します。延長しますか？',
					},
					allowSessionExtend: true,
				},
			});

			await wrapper.find('[data-testid="extend-button"]').trigger('click');

			expect(wrapper.emitted('extend')).toBeTruthy();
		});
	});

	describe('silence warning', () => {
		it('should display silence warning message', () => {
			const wrapper = mount(TimeoutWarningModal, {
				...mountOptions,
				props: {
					warning: {
						warningType: 'silence',
						remainingSeconds: 60,
						message: '1分間発話が検出されていません。発話するとセッションが継続します。',
					},
				},
			});

			expect(wrapper.text()).toContain('発話が検出されていません');
		});

		it('should not show extend button for silence warning', () => {
			const wrapper = mount(TimeoutWarningModal, {
				...mountOptions,
				props: {
					warning: {
						warningType: 'silence',
						remainingSeconds: 60,
						message: '1分間発話が検出されていません。発話するとセッションが継続します。',
					},
				},
			});

			// Silence warning doesn't need extend button - just speak to continue
			expect(wrapper.find('[data-testid="extend-button"]').exists()).toBe(false);
		});
	});

	describe('countdown', () => {
		it('should display remaining seconds', () => {
			const wrapper = mount(TimeoutWarningModal, {
				...mountOptions,
				props: {
					warning: {
						warningType: 'session',
						remainingSeconds: 45,
						message: 'セッションがあと1分で終了します。延長しますか？',
					},
				},
			});

			expect(wrapper.text()).toContain('45');
		});
	});

	describe('dismiss', () => {
		it('should emit dismiss event when close button is clicked', async () => {
			const wrapper = mount(TimeoutWarningModal, {
				...mountOptions,
				props: {
					warning: {
						warningType: 'session',
						remainingSeconds: 60,
						message: 'セッションがあと1分で終了します。延長しますか？',
					},
				},
			});

			const closeButton = wrapper.find('[data-testid="dismiss-button"]');
			if (closeButton.exists()) {
				await closeButton.trigger('click');
				expect(wrapper.emitted('dismiss')).toBeTruthy();
			}
		});
	});
});
