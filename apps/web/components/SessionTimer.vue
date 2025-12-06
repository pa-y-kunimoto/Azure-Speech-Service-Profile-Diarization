<script setup lang="ts">
/**
 * SessionTimer - Displays remaining session time
 *
 * Shows the remaining time until session timeout and silence timeout.
 * Changes color based on remaining time (warning at 5 min, critical at 1 min).
 */

import { computed } from 'vue';

interface Props {
	/** Seconds remaining until session timeout, null = unlimited */
	sessionTimeoutRemaining: number | null;
	/** Seconds remaining until silence timeout, null = disabled */
	silenceTimeoutRemaining: number | null;
}

const props = defineProps<Props>();

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formatted session timeout
 */
const formattedSessionTimeout = computed(() => {
	if (props.sessionTimeoutRemaining === null) {
		return '無制限';
	}
	return formatTime(props.sessionTimeoutRemaining);
});

/**
 * Formatted silence timeout
 */
const formattedSilenceTimeout = computed(() => {
	if (props.silenceTimeoutRemaining === null) {
		return null;
	}
	return formatTime(props.silenceTimeoutRemaining);
});

/**
 * Warning state based on remaining time
 */
const timerClasses = computed(() => {
	const classes: string[] = [];

	// Check session timeout for warning states
	if (props.sessionTimeoutRemaining !== null) {
		if (props.sessionTimeoutRemaining < 60) {
			classes.push('critical');
		} else if (props.sessionTimeoutRemaining < 300) {
			classes.push('warning');
		}
	}

	// Also check silence timeout
	if (props.silenceTimeoutRemaining !== null) {
		if (props.silenceTimeoutRemaining < 60 && !classes.includes('critical')) {
			classes.push('critical');
		} else if (
			props.silenceTimeoutRemaining < 300 &&
			!classes.includes('warning') &&
			!classes.includes('critical')
		) {
			classes.push('warning');
		}
	}

	return classes;
});
</script>

<template>
	<div
		data-testid="session-timer"
		class="session-timer"
		:class="timerClasses"
	>
		<div class="timer-row">
			<span class="timer-label">セッション:</span>
			<span class="timer-value">{{ formattedSessionTimeout }}</span>
		</div>
		<div v-if="formattedSilenceTimeout" class="timer-row silence">
			<span class="timer-label">無音:</span>
			<span class="timer-value">{{ formattedSilenceTimeout }}</span>
		</div>
	</div>
</template>

<style scoped>
.session-timer {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	padding: 0.5rem 1rem;
	background-color: #f3f4f6;
	border-radius: 0.5rem;
	font-family: ui-monospace, monospace;
	font-size: 0.875rem;
	transition: background-color 0.3s, color 0.3s;
}

.timer-row {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.timer-label {
	color: #6b7280;
	font-size: 0.75rem;
}

.timer-value {
	font-weight: 600;
	color: #1f2937;
}

/* Warning state - under 5 minutes */
.session-timer.warning {
	background-color: #fef3c7;
}

.session-timer.warning .timer-value {
	color: #d97706;
}

/* Critical state - under 1 minute */
.session-timer.critical {
	background-color: #fee2e2;
	animation: pulse 1s infinite;
}

.session-timer.critical .timer-value {
	color: #dc2626;
	font-weight: 700;
}

.silence {
	font-size: 0.75rem;
}

.silence .timer-label {
	font-size: 0.625rem;
}

.silence .timer-value {
	font-size: 0.75rem;
}

@keyframes pulse {
	0%, 100% {
		opacity: 1;
	}
	50% {
		opacity: 0.7;
	}
}
</style>
