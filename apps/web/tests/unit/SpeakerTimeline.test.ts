/**
 * SpeakerTimeline Component Tests (T068)
 *
 * Tests for the speaker timeline display component.
 * Shows session results with utterances grouped by speaker in timeline format.
 */

import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SpeakerTimeline from '../../components/SpeakerTimeline.vue';

// Mock Utterance type matching core package
interface Utterance {
	id: string;
	sessionId: string;
	azureSpeakerId: string;
	speakerName: string;
	text: string;
	startOffsetSeconds: number;
	endOffsetSeconds: number;
	durationSeconds: number;
	confidence: number;
	recognizedAt: string;
}

describe('SpeakerTimeline', () => {
	const createUtterance = (overrides: Partial<Utterance> = {}): Utterance => ({
		id: 'utt-1',
		sessionId: 'session-1',
		azureSpeakerId: 'Guest-1',
		speakerName: '田中さん',
		text: 'こんにちは',
		startOffsetSeconds: 0,
		endOffsetSeconds: 2,
		durationSeconds: 2,
		confidence: 0.95,
		recognizedAt: new Date().toISOString(),
		...overrides,
	});

	describe('empty state', () => {
		it('should render empty state when no utterances', () => {
			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances: [],
				},
			});

			expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true);
			expect(wrapper.text()).toContain('発話履歴がありません');
		});

		it('should hide empty state when utterances exist', () => {
			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances: [createUtterance()],
					sessionDurationSeconds: 60,
				},
			});

			expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false);
		});
	});

	describe('statistics section', () => {
		it('should display total speakers count', () => {
			const utterances = [
				createUtterance({ id: 'utt-1', azureSpeakerId: 'Guest-1', speakerName: '田中さん' }),
				createUtterance({ id: 'utt-2', azureSpeakerId: 'Guest-2', speakerName: '鈴木さん' }),
				createUtterance({ id: 'utt-3', azureSpeakerId: 'Guest-1', speakerName: '田中さん' }),
			];

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances,
					sessionDurationSeconds: 60,
				},
			});

			const statsSection = wrapper.find('[data-testid="stats-section"]');
			expect(statsSection.text()).toContain('2'); // 2 unique speakers
			expect(statsSection.text()).toContain('話者数');
		});

		it('should display total utterances count', () => {
			const utterances = [
				createUtterance({ id: 'utt-1' }),
				createUtterance({ id: 'utt-2' }),
				createUtterance({ id: 'utt-3' }),
			];

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances,
					sessionDurationSeconds: 60,
				},
			});

			const statsSection = wrapper.find('[data-testid="stats-section"]');
			expect(statsSection.text()).toContain('3'); // 3 utterances
			expect(statsSection.text()).toContain('発話数');
		});

		it('should display session duration', () => {
			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances: [createUtterance()],
					sessionDurationSeconds: 125, // 2分5秒
				},
			});

			const statsSection = wrapper.find('[data-testid="stats-section"]');
			expect(statsSection.text()).toContain('2分5秒');
			expect(statsSection.text()).toContain('合計時間');
		});
	});

	describe('speaker filter', () => {
		it('should render filter buttons for each speaker', () => {
			const utterances = [
				createUtterance({ id: 'utt-1', azureSpeakerId: 'Guest-1', speakerName: '田中さん' }),
				createUtterance({ id: 'utt-2', azureSpeakerId: 'Guest-2', speakerName: '鈴木さん' }),
			];

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances,
					sessionDurationSeconds: 60,
				},
			});

			expect(wrapper.find('[data-testid="filter-all"]').exists()).toBe(true);
			expect(wrapper.find('[data-testid="filter-Guest-1"]').exists()).toBe(true);
			expect(wrapper.find('[data-testid="filter-Guest-2"]').exists()).toBe(true);
		});

		it('should emit speakerSelect when filter is clicked', async () => {
			const utterances = [
				createUtterance({ id: 'utt-1', azureSpeakerId: 'Guest-1', speakerName: '田中さん' }),
			];

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances,
					sessionDurationSeconds: 60,
				},
			});

			await wrapper.find('[data-testid="filter-Guest-1"]').trigger('click');

			expect(wrapper.emitted('speakerSelect')).toBeTruthy();
			expect(wrapper.emitted('speakerSelect')?.[0]).toEqual(['Guest-1']);
		});

		it('should show utterance count in filter button', () => {
			const utterances = [
				createUtterance({ id: 'utt-1', azureSpeakerId: 'Guest-1', speakerName: '田中さん' }),
				createUtterance({ id: 'utt-2', azureSpeakerId: 'Guest-1', speakerName: '田中さん' }),
				createUtterance({ id: 'utt-3', azureSpeakerId: 'Guest-1', speakerName: '田中さん' }),
			];

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances,
					sessionDurationSeconds: 60,
				},
			});

			expect(wrapper.find('[data-testid="filter-Guest-1"]').text()).toContain('(3)');
		});

		it('should filter utterances when speaker is selected', () => {
			const utterances = [
				createUtterance({
					id: 'utt-1',
					azureSpeakerId: 'Guest-1',
					speakerName: '田中さん',
					text: '田中の発話',
				}),
				createUtterance({
					id: 'utt-2',
					azureSpeakerId: 'Guest-2',
					speakerName: '鈴木さん',
					text: '鈴木の発話',
				}),
			];

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances,
					sessionDurationSeconds: 60,
					selectedSpeaker: 'Guest-1',
				},
			});

			const utteranceList = wrapper.find('[data-testid="utterance-list"]');
			expect(utteranceList.text()).toContain('田中の発話');
			expect(utteranceList.text()).not.toContain('鈴木の発話');
		});
	});

	describe('visual timeline', () => {
		it('should render timeline track', () => {
			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances: [createUtterance()],
					sessionDurationSeconds: 60,
				},
			});

			expect(wrapper.find('[data-testid="timeline-track"]').exists()).toBe(true);
		});

		it('should render timeline segments for each utterance', () => {
			const utterances = [
				createUtterance({ id: 'utt-1' }),
				createUtterance({ id: 'utt-2', startOffsetSeconds: 10 }),
			];

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances,
					sessionDurationSeconds: 60,
				},
			});

			expect(wrapper.find('[data-testid="timeline-segment-utt-1"]').exists()).toBe(true);
			expect(wrapper.find('[data-testid="timeline-segment-utt-2"]').exists()).toBe(true);
		});

		it('should position segments correctly based on time', () => {
			const utterance = createUtterance({
				id: 'utt-1',
				startOffsetSeconds: 30,
				durationSeconds: 6,
			});

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances: [utterance],
					sessionDurationSeconds: 60,
				},
			});

			const segment = wrapper.find('[data-testid="timeline-segment-utt-1"]');
			const style = segment.element.getAttribute('style');
			expect(style).toContain('left: 50%'); // 30/60 = 50%
			expect(style).toContain('width: 10%'); // 6/60 = 10%
		});

		it('should emit utteranceClick when segment is clicked', async () => {
			const utterance = createUtterance();

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances: [utterance],
					sessionDurationSeconds: 60,
				},
			});

			await wrapper.find('[data-testid="timeline-segment-utt-1"]').trigger('click');

			expect(wrapper.emitted('utteranceClick')).toBeTruthy();
			expect(wrapper.emitted('utteranceClick')?.[0]).toEqual([utterance]);
		});

		it('should display time axis labels', () => {
			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances: [createUtterance()],
					sessionDurationSeconds: 120, // 2 minutes
				},
			});

			const timelineSection = wrapper.find('[data-testid="timeline-section"]');
			expect(timelineSection.text()).toContain('00:00');
			expect(timelineSection.text()).toContain('01:00'); // midpoint
			expect(timelineSection.text()).toContain('02:00'); // end
		});
	});

	describe('speaker cards', () => {
		it('should render speaker card for each unique speaker', () => {
			const utterances = [
				createUtterance({ id: 'utt-1', azureSpeakerId: 'Guest-1', speakerName: '田中さん' }),
				createUtterance({ id: 'utt-2', azureSpeakerId: 'Guest-2', speakerName: '鈴木さん' }),
			];

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances,
					sessionDurationSeconds: 60,
				},
			});

			expect(wrapper.find('[data-testid="speaker-card-Guest-1"]').exists()).toBe(true);
			expect(wrapper.find('[data-testid="speaker-card-Guest-2"]').exists()).toBe(true);
		});

		it('should display speaker name in card', () => {
			const utterance = createUtterance({ speakerName: '田中さん' });

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances: [utterance],
					sessionDurationSeconds: 60,
				},
			});

			expect(wrapper.find('[data-testid="speaker-card-Guest-1"]').text()).toContain('田中さん');
		});

		it('should display utterance count in card', () => {
			const utterances = [
				createUtterance({ id: 'utt-1', azureSpeakerId: 'Guest-1' }),
				createUtterance({ id: 'utt-2', azureSpeakerId: 'Guest-1' }),
			];

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances,
					sessionDurationSeconds: 60,
				},
			});

			expect(wrapper.find('[data-testid="speaker-card-Guest-1"]').text()).toContain('発話数: 2');
		});

		it('should display total duration in card', () => {
			const utterances = [
				createUtterance({ id: 'utt-1', azureSpeakerId: 'Guest-1', durationSeconds: 30 }),
				createUtterance({ id: 'utt-2', azureSpeakerId: 'Guest-1', durationSeconds: 35 }),
			];

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances,
					sessionDurationSeconds: 120,
				},
			});

			expect(wrapper.find('[data-testid="speaker-card-Guest-1"]').text()).toContain('1分5秒');
		});

		it('should emit speakerSelect when card is clicked', async () => {
			const utterance = createUtterance({ azureSpeakerId: 'Guest-1' });

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances: [utterance],
					sessionDurationSeconds: 60,
				},
			});

			await wrapper.find('[data-testid="speaker-card-Guest-1"]').trigger('click');

			expect(wrapper.emitted('speakerSelect')).toBeTruthy();
			expect(wrapper.emitted('speakerSelect')?.[0]).toEqual(['Guest-1']);
		});

		it('should highlight selected speaker card', () => {
			const utterances = [
				createUtterance({ id: 'utt-1', azureSpeakerId: 'Guest-1' }),
				createUtterance({ id: 'utt-2', azureSpeakerId: 'Guest-2' }),
			];

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances,
					sessionDurationSeconds: 60,
					selectedSpeaker: 'Guest-1',
				},
			});

			expect(wrapper.find('[data-testid="speaker-card-Guest-1"]').classes()).toContain('ring-2');
			expect(wrapper.find('[data-testid="speaker-card-Guest-2"]').classes()).not.toContain(
				'ring-2'
			);
		});
	});

	describe('utterance list', () => {
		it('should render utterance list', () => {
			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances: [createUtterance()],
					sessionDurationSeconds: 60,
				},
			});

			expect(wrapper.find('[data-testid="utterance-list"]').exists()).toBe(true);
		});

		it('should display utterance text', () => {
			const utterance = createUtterance({ text: 'テスト発話' });

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances: [utterance],
					sessionDurationSeconds: 60,
				},
			});

			expect(wrapper.find('[data-testid="utterance-row-utt-1"]').text()).toContain('テスト発話');
		});

		it('should display speaker name in utterance row', () => {
			const utterance = createUtterance({ speakerName: '田中さん' });

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances: [utterance],
					sessionDurationSeconds: 60,
				},
			});

			expect(wrapper.find('[data-testid="utterance-row-utt-1"]').text()).toContain('田中さん');
		});

		it('should display timestamp in utterance row', () => {
			const utterance = createUtterance({ startOffsetSeconds: 125 }); // 2:05

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances: [utterance],
					sessionDurationSeconds: 300,
				},
			});

			expect(wrapper.find('[data-testid="utterance-row-utt-1"]').text()).toContain('02:05');
		});

		it('should emit utteranceClick when row is clicked', async () => {
			const utterance = createUtterance();

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances: [utterance],
					sessionDurationSeconds: 60,
				},
			});

			await wrapper.find('[data-testid="utterance-row-utt-1"]').trigger('click');

			expect(wrapper.emitted('utteranceClick')).toBeTruthy();
			expect(wrapper.emitted('utteranceClick')?.[0]).toEqual([utterance]);
		});
	});

	describe('speaker color coding', () => {
		it('should assign consistent colors to same speaker', () => {
			const utterances = [
				createUtterance({ id: 'utt-1', azureSpeakerId: 'Guest-1', speakerName: '田中さん' }),
				createUtterance({ id: 'utt-2', azureSpeakerId: 'Guest-1', speakerName: '田中さん' }),
			];

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances,
					sessionDurationSeconds: 60,
				},
			});

			const segments = wrapper.findAll('.timeline-segment');
			const segment1Classes = segments[0]?.classes().join(' ');
			const segment2Classes = segments[1]?.classes().join(' ');
			expect(segment1Classes).toBe(segment2Classes);
		});

		it('should assign different colors to different speakers', () => {
			const utterances = [
				createUtterance({ id: 'utt-1', azureSpeakerId: 'Guest-1', speakerName: '田中さん' }),
				createUtterance({ id: 'utt-2', azureSpeakerId: 'Guest-2', speakerName: '鈴木さん' }),
			];

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances,
					sessionDurationSeconds: 60,
				},
			});

			const segments = wrapper.findAll('.timeline-segment');
			const segment1BgClass = segments[0]?.classes().find((c) => c.startsWith('bg-'));
			const segment2BgClass = segments[1]?.classes().find((c) => c.startsWith('bg-'));
			// Different speakers should have different background colors
			expect(segment1BgClass).not.toBe(segment2BgClass);
		});
	});

	describe('speaker ranking', () => {
		it('should sort speakers by total duration (descending)', () => {
			const utterances = [
				createUtterance({
					id: 'utt-1',
					azureSpeakerId: 'Guest-1',
					speakerName: '田中さん',
					durationSeconds: 5,
				}),
				createUtterance({
					id: 'utt-2',
					azureSpeakerId: 'Guest-2',
					speakerName: '鈴木さん',
					durationSeconds: 30,
				}),
				createUtterance({
					id: 'utt-3',
					azureSpeakerId: 'Guest-3',
					speakerName: '佐藤さん',
					durationSeconds: 15,
				}),
			];

			const wrapper = mount(SpeakerTimeline, {
				props: {
					utterances,
					sessionDurationSeconds: 120,
				},
			});

			const cards = wrapper.findAll('.speaker-card');
			// Most duration first: 鈴木 (30s) > 佐藤 (15s) > 田中 (5s)
			expect(cards[0]?.text()).toContain('鈴木さん');
			expect(cards[1]?.text()).toContain('佐藤さん');
			expect(cards[2]?.text()).toContain('田中さん');
		});
	});
});
