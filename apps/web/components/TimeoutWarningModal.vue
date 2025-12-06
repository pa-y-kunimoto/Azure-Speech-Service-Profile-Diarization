<script setup lang="ts">
/**
 * TimeoutWarningModal - Displays timeout warning with extend option
 *
 * Shows a modal when session or silence timeout is approaching.
 * Allows users to extend session timeout (not applicable for silence timeout).
 */

import { computed } from 'vue';

interface TimeoutWarning {
	warningType: 'session' | 'silence';
	remainingSeconds: number;
	message: string;
}

interface Props {
	/** The warning to display, or null if no warning */
	warning: TimeoutWarning | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
	/** Emitted when user clicks extend button */
	extend: [];
	/** Emitted when user dismisses the modal */
	dismiss: [];
}>();

/**
 * Whether to show the extend button
 */
const showExtendButton = computed(() => {
	return props.warning?.warningType === 'session';
});

/**
 * Title based on warning type
 */
const title = computed(() => {
	if (!props.warning) return '';
	return props.warning.warningType === 'session' ? 'セッション終了間近' : '無音検出';
});

/**
 * Icon based on warning type
 */
const iconClass = computed(() => {
	if (!props.warning) return '';
	return props.warning.warningType === 'session' ? 'icon-clock' : 'icon-silence';
});

function handleExtend() {
	emit('extend');
}

function handleDismiss() {
	emit('dismiss');
}
</script>

<template>
	<Teleport to="body">
		<div
			v-if="warning"
			data-testid="timeout-warning-modal"
			class="modal-overlay"
		>
			<div class="modal-content" :class="warning.warningType">
				<button
					data-testid="dismiss-button"
					class="dismiss-button"
					@click="handleDismiss"
					aria-label="閉じる"
				>
					×
				</button>

				<div class="modal-header">
					<div class="icon" :class="iconClass">
						<template v-if="warning.warningType === 'session'">⏰</template>
						<template v-else>🔇</template>
					</div>
					<h2>{{ title }}</h2>
				</div>

				<div class="modal-body">
					<p class="message">{{ warning.message }}</p>

					<div class="countdown">
						<span class="countdown-value">{{ warning.remainingSeconds }}</span>
						<span class="countdown-label">秒</span>
					</div>
				</div>

				<div class="modal-footer">
					<button
						v-if="showExtendButton"
						data-testid="extend-button"
						class="extend-button"
						@click="handleExtend"
					>
						セッションを延長する
					</button>
					<p v-else class="hint">
						発話するとセッションが継続します
					</p>
				</div>
			</div>
		</div>
	</Teleport>
</template>

<style scoped>
.modal-overlay {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-color: rgba(0, 0, 0, 0.5);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 9999;
}

.modal-content {
	background-color: white;
	border-radius: 1rem;
	padding: 1.5rem;
	max-width: 400px;
	width: 90%;
	position: relative;
	box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
	animation: slideIn 0.3s ease-out;
}

.modal-content.session {
	border-top: 4px solid #f59e0b;
}

.modal-content.silence {
	border-top: 4px solid #6366f1;
}

.dismiss-button {
	position: absolute;
	top: 0.75rem;
	right: 0.75rem;
	width: 2rem;
	height: 2rem;
	border: none;
	background: none;
	font-size: 1.5rem;
	color: #9ca3af;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 0.25rem;
	transition: color 0.2s, background-color 0.2s;
}

.dismiss-button:hover {
	color: #374151;
	background-color: #f3f4f6;
}

.modal-header {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	margin-bottom: 1rem;
}

.icon {
	font-size: 2rem;
}

.modal-header h2 {
	margin: 0;
	font-size: 1.25rem;
	font-weight: 600;
	color: #1f2937;
}

.modal-body {
	text-align: center;
	margin-bottom: 1.5rem;
}

.message {
	color: #4b5563;
	margin: 0 0 1rem 0;
	line-height: 1.5;
}

.countdown {
	display: flex;
	align-items: baseline;
	justify-content: center;
	gap: 0.25rem;
}

.countdown-value {
	font-size: 3rem;
	font-weight: 700;
	color: #dc2626;
	font-family: ui-monospace, monospace;
	animation: pulse 1s infinite;
}

.countdown-label {
	font-size: 1.25rem;
	color: #6b7280;
}

.modal-footer {
	display: flex;
	justify-content: center;
}

.extend-button {
	background-color: #10b981;
	color: white;
	border: none;
	padding: 0.75rem 1.5rem;
	border-radius: 0.5rem;
	font-size: 1rem;
	font-weight: 600;
	cursor: pointer;
	transition: background-color 0.2s, transform 0.1s;
}

.extend-button:hover {
	background-color: #059669;
}

.extend-button:active {
	transform: scale(0.98);
}

.hint {
	color: #6b7280;
	font-size: 0.875rem;
	margin: 0;
	font-style: italic;
}

@keyframes slideIn {
	from {
		opacity: 0;
		transform: translateY(-20px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes pulse {
	0%, 100% {
		opacity: 1;
	}
	50% {
		opacity: 0.6;
	}
}
</style>
