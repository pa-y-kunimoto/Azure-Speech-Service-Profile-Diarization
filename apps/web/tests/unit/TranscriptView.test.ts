/**
 * TranscriptView Component Tests
 *
 * Tests for the real-time transcript display component.
 * Shows recognized text with speaker identification.
 */

import { describe, it, expect} from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, ref, h } from 'vue';

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

// TranscriptView component (to be implemented)
const TranscriptView = defineComponent({
	name: 'TranscriptView',
	props: {
		utterances: {
			type: Array as () => Utterance[],
			default: () => [],
		},
		interimText: {
			type: String,
			default: '',
		},
		interimSpeaker: {
			type: String,
			default: '',
		},
		isActive: {
			type: Boolean,
			default: false,
		},
		autoScroll: {
			type: Boolean,
			default: true,
		},
	},
	emits: ['speakerClick'],
	setup(props, { emit }) {
		const containerRef = ref<HTMLElement | null>(null);

		const formatTime = (seconds: number): string => {
			const mins = Math.floor(seconds / 60);
			const secs = Math.floor(seconds % 60);
			return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		};

		const formatConfidence = (confidence: number): string => {
			return `${Math.round(confidence * 100)}%`;
		};

		const getSpeakerColor = (speakerName: string): string => {
			const colors = [
				'bg-blue-100 text-blue-800',
				'bg-green-100 text-green-800',
				'bg-purple-100 text-purple-800',
				'bg-orange-100 text-orange-800',
				'bg-pink-100 text-pink-800',
			];
			const hash = speakerName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
			return colors[hash % colors.length] || 'bg-gray-100 text-gray-800';
		};

		const handleSpeakerClick = (utterance: Utterance) => {
			emit('speakerClick', utterance.azureSpeakerId, utterance.speakerName);
		};

		return () => {
			const utteranceElements = props.utterances.map((utterance) =>
				h(
					'div',
					{
						key: utterance.id,
						class: 'utterance-item p-3 border-b last:border-b-0',
						'data-testid': `utterance-${utterance.id}`,
					},
					[
						h('div', { class: 'flex items-center justify-between mb-1' }, [
							h(
								'button',
								{
									class: `speaker-badge px-2 py-1 rounded text-sm font-medium ${getSpeakerColor(utterance.speakerName)}`,
									onClick: () => handleSpeakerClick(utterance),
									'data-testid': `speaker-${utterance.azureSpeakerId}`,
								},
								utterance.speakerName
							),
							h('span', { class: 'timestamp text-xs text-gray-500' }, [
								formatTime(utterance.startOffsetSeconds),
								' - ',
								formatTime(utterance.endOffsetSeconds),
							]),
						]),
						h(
							'p',
							{ class: 'utterance-text text-gray-900 mt-1' },
							utterance.text
						),
						h(
							'span',
							{ class: 'confidence text-xs text-gray-400 mt-1 block' },
							`信頼度: ${formatConfidence(utterance.confidence)}`
						),
					]
				)
			);

			const interimElement =
				props.interimText && props.isActive
					? h(
							'div',
							{
								class: 'interim-text p-3 bg-yellow-50 border-l-4 border-yellow-400 animate-pulse',
								'data-testid': 'interim-text',
							},
							[
								props.interimSpeaker &&
									h(
										'span',
										{ class: 'speaker-badge px-2 py-1 rounded text-sm font-medium bg-yellow-100 text-yellow-800 mr-2' },
										props.interimSpeaker
									),
								h('span', { class: 'text-gray-700 italic' }, props.interimText),
							]
						)
					: null;

			const emptyState =
				props.utterances.length === 0 && !props.interimText
					? h(
							'div',
							{
								class: 'empty-state text-center py-8 text-gray-500',
								'data-testid': 'empty-state',
							},
							[
								h('p', { class: 'text-lg' }, '発話がありません'),
								props.isActive
									? h('p', { class: 'text-sm mt-2' }, 'マイクに向かって話してください')
									: h('p', { class: 'text-sm mt-2' }, '認識を開始してください'),
							]
						)
					: null;

			const activeIndicator = props.isActive
				? h(
						'div',
						{
							class: 'active-indicator flex items-center gap-2 p-2 bg-green-50 border-b',
							'data-testid': 'active-indicator',
						},
						[
							h('span', { class: 'w-2 h-2 rounded-full bg-green-500 animate-pulse' }),
							h('span', { class: 'text-sm text-green-700' }, '認識中...'),
						]
					)
				: null;

			return h(
				'div',
				{
					ref: containerRef,
					class: 'transcript-view border rounded-lg overflow-hidden bg-white',
					'data-testid': 'transcript-view',
				},
				[activeIndicator, emptyState, ...utteranceElements, interimElement]
			);
		};
	},
});

describe('TranscriptView', () => {
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

	describe('rendering', () => {
		it('should render empty state when no utterances', () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [],
					isActive: false,
				},
			});

			expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true);
			expect(wrapper.text()).toContain('発話がありません');
			expect(wrapper.text()).toContain('認識を開始してください');
		});

		it('should render empty state with active hint when recording', () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [],
					isActive: true,
				},
			});

			expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true);
			expect(wrapper.text()).toContain('マイクに向かって話してください');
		});

		it('should render utterance list', () => {
			const utterances = [
				createUtterance({ id: 'utt-1', text: '最初の発話' }),
				createUtterance({ id: 'utt-2', text: '二番目の発話', startOffsetSeconds: 3 }),
			];

			const wrapper = mount(TranscriptView, {
				props: { utterances },
			});

			expect(wrapper.findAll('.utterance-item')).toHaveLength(2);
			expect(wrapper.text()).toContain('最初の発話');
			expect(wrapper.text()).toContain('二番目の発話');
		});

		it('should display speaker name badge', () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [createUtterance({ speakerName: '田中さん' })],
				},
			});

			expect(wrapper.find('.speaker-badge').text()).toBe('田中さん');
		});

		it('should display timestamp', () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [
						createUtterance({
							startOffsetSeconds: 65, // 1:05
							endOffsetSeconds: 70, // 1:10
						}),
					],
				},
			});

			expect(wrapper.find('.timestamp').text()).toContain('01:05');
			expect(wrapper.find('.timestamp').text()).toContain('01:10');
		});

		it('should display confidence score', () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [createUtterance({ confidence: 0.87 })],
				},
			});

			expect(wrapper.find('.confidence').text()).toContain('87%');
		});
	});

	describe('active indicator', () => {
		it('should show active indicator when isActive is true', () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [],
					isActive: true,
				},
			});

			expect(wrapper.find('[data-testid="active-indicator"]').exists()).toBe(true);
			expect(wrapper.text()).toContain('認識中...');
		});

		it('should hide active indicator when isActive is false', () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [],
					isActive: false,
				},
			});

			expect(wrapper.find('[data-testid="active-indicator"]').exists()).toBe(false);
		});
	});

	describe('interim text', () => {
		it('should display interim text when active', () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [],
					interimText: '今日は...',
					isActive: true,
				},
			});

			expect(wrapper.find('[data-testid="interim-text"]').exists()).toBe(true);
			expect(wrapper.text()).toContain('今日は...');
		});

		it('should not display interim text when inactive', () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [],
					interimText: '今日は...',
					isActive: false,
				},
			});

			expect(wrapper.find('[data-testid="interim-text"]').exists()).toBe(false);
		});

		it('should display interim speaker name', () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [],
					interimText: '今日は...',
					interimSpeaker: '鈴木さん',
					isActive: true,
				},
			});

			const interimElement = wrapper.find('[data-testid="interim-text"]');
			expect(interimElement.text()).toContain('鈴木さん');
		});
	});

	describe('speaker interaction', () => {
		it('should emit speakerClick when speaker badge is clicked', async () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [
						createUtterance({
							azureSpeakerId: 'Guest-1',
							speakerName: '田中さん',
						}),
					],
				},
			});

			await wrapper.find('[data-testid="speaker-Guest-1"]').trigger('click');

			expect(wrapper.emitted('speakerClick')).toBeTruthy();
			expect(wrapper.emitted('speakerClick')?.[0]).toEqual(['Guest-1', '田中さん']);
		});
	});

	describe('multiple speakers', () => {
		it('should display different colors for different speakers', () => {
			const utterances = [
				createUtterance({ id: 'utt-1', speakerName: '田中さん', azureSpeakerId: 'Guest-1' }),
				createUtterance({ id: 'utt-2', speakerName: '鈴木さん', azureSpeakerId: 'Guest-2' }),
			];

			const wrapper = mount(TranscriptView, {
				props: { utterances },
			});

			const badges = wrapper.findAll('.speaker-badge');
			expect(badges).toHaveLength(2);
			// Check that badges have different class combinations (color coding)
			const badge1Classes = badges[0]?.classes().join(' ');
			const badge2Classes = badges[1]?.classes().join(' ');
			// Different speakers should have different colors based on name hash
			expect(badge1Classes).not.toBe(badge2Classes);
		});

		it('should maintain speaker color consistency', () => {
			const utterances = [
				createUtterance({ id: 'utt-1', speakerName: '田中さん', azureSpeakerId: 'Guest-1' }),
				createUtterance({ id: 'utt-2', speakerName: '鈴木さん', azureSpeakerId: 'Guest-2' }),
				createUtterance({ id: 'utt-3', speakerName: '田中さん', azureSpeakerId: 'Guest-1' }),
			];

			const wrapper = mount(TranscriptView, {
				props: { utterances },
			});

			const badges = wrapper.findAll('.speaker-badge');
			// First and third badge (same speaker) should have same color
			const badge1Classes = badges[0]?.classes().join(' ');
			const badge3Classes = badges[2]?.classes().join(' ');
			expect(badge1Classes).toBe(badge3Classes);
		});
	});

	describe('time formatting', () => {
		it('should format seconds to mm:ss', () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [
						createUtterance({
							startOffsetSeconds: 0,
							endOffsetSeconds: 5,
						}),
					],
				},
			});

			expect(wrapper.find('.timestamp').text()).toContain('00:00');
			expect(wrapper.find('.timestamp').text()).toContain('00:05');
		});

		it('should handle minutes correctly', () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [
						createUtterance({
							startOffsetSeconds: 125, // 2:05
							endOffsetSeconds: 180, // 3:00
						}),
					],
				},
			});

			expect(wrapper.find('.timestamp').text()).toContain('02:05');
			expect(wrapper.find('.timestamp').text()).toContain('03:00');
		});
	});

	describe('accessibility', () => {
		it('should have proper structure for screen readers', () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [createUtterance()],
				},
			});

			expect(wrapper.find('[data-testid="transcript-view"]').exists()).toBe(true);
			expect(wrapper.find('.utterance-text').exists()).toBe(true);
		});

		it('should have clickable speaker badges as buttons', () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [createUtterance()],
				},
			});

			const badge = wrapper.find('.speaker-badge');
			expect(badge.element.tagName).toBe('BUTTON');
		});
	});

	describe('styling', () => {
		it('should apply pulse animation to interim text', () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [],
					interimText: 'テスト...',
					isActive: true,
				},
			});

			expect(wrapper.find('[data-testid="interim-text"]').classes()).toContain('animate-pulse');
		});

		it('should have border styling on utterance items', () => {
			const wrapper = mount(TranscriptView, {
				props: {
					utterances: [createUtterance()],
				},
			});

			expect(wrapper.find('.utterance-item').classes()).toContain('border-b');
		});
	});
});
