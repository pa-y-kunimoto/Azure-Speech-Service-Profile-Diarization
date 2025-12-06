/**
 * SessionTimer Component Unit Tests
 */

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SessionTimer from '~/components/SessionTimer.vue';

describe('SessionTimer', () => {
	describe('rendering', () => {
		it('should render remaining time in MM:SS format', () => {
			const wrapper = mount(SessionTimer, {
				props: {
					sessionTimeoutRemaining: 125, // 2:05
					silenceTimeoutRemaining: null,
				},
			});

			expect(wrapper.text()).toContain('02:05');
		});

		it('should render "無制限" when sessionTimeoutRemaining is null', () => {
			const wrapper = mount(SessionTimer, {
				props: {
					sessionTimeoutRemaining: null,
					silenceTimeoutRemaining: null,
				},
			});

			expect(wrapper.text()).toContain('無制限');
		});

		it('should render silence timeout when provided', () => {
			const wrapper = mount(SessionTimer, {
				props: {
					sessionTimeoutRemaining: 600,
					silenceTimeoutRemaining: 120, // 2:00
				},
			});

			expect(wrapper.text()).toContain('02:00');
		});
	});

	describe('warning states', () => {
		it('should have warning class when under 5 minutes', () => {
			const wrapper = mount(SessionTimer, {
				props: {
					sessionTimeoutRemaining: 299, // 4:59
					silenceTimeoutRemaining: null,
				},
			});

			expect(wrapper.find('[data-testid="session-timer"]').classes()).toContain('warning');
		});

		it('should have critical class when under 1 minute', () => {
			const wrapper = mount(SessionTimer, {
				props: {
					sessionTimeoutRemaining: 59, // 0:59
					silenceTimeoutRemaining: null,
				},
			});

			expect(wrapper.find('[data-testid="session-timer"]').classes()).toContain('critical');
		});

		it('should not have warning class when over 5 minutes', () => {
			const wrapper = mount(SessionTimer, {
				props: {
					sessionTimeoutRemaining: 600, // 10:00
					silenceTimeoutRemaining: null,
				},
			});

			expect(wrapper.find('[data-testid="session-timer"]').classes()).not.toContain('warning');
			expect(wrapper.find('[data-testid="session-timer"]').classes()).not.toContain('critical');
		});
	});

	describe('formatting', () => {
		it('should format single digit seconds with leading zero', () => {
			const wrapper = mount(SessionTimer, {
				props: {
					sessionTimeoutRemaining: 65, // 1:05
					silenceTimeoutRemaining: null,
				},
			});

			expect(wrapper.text()).toContain('01:05');
		});

		it('should format single digit minutes with leading zero', () => {
			const wrapper = mount(SessionTimer, {
				props: {
					sessionTimeoutRemaining: 540, // 9:00
					silenceTimeoutRemaining: null,
				},
			});

			expect(wrapper.text()).toContain('09:00');
		});

		it('should handle zero seconds correctly', () => {
			const wrapper = mount(SessionTimer, {
				props: {
					sessionTimeoutRemaining: 0,
					silenceTimeoutRemaining: null,
				},
			});

			expect(wrapper.text()).toContain('00:00');
		});
	});
});
