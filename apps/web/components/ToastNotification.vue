<script setup lang="ts">
/**
 * Toast Notification Component (T076)
 *
 * Displays toast notifications for success, error, warning, and info messages.
 */

import { ref, computed, onUnmounted, watch } from 'vue';

export interface Toast {
	id: string;
	type: 'success' | 'error' | 'warning' | 'info';
	title: string;
	message?: string;
	duration?: number;
	action?: {
		label: string;
		onClick: () => void;
	};
}

const props = withDefaults(
	defineProps<{
		toasts: Toast[];
		position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
	}>(),
	{
		position: 'top-right',
	}
);

const emit = defineEmits<{
	dismiss: [id: string];
}>();

// Auto-dismiss timers
const timers = ref<Map<string, ReturnType<typeof setTimeout>>>(new Map());

// Toast type styling
const typeStyles = {
	success: {
		bg: 'bg-green-50',
		border: 'border-green-400',
		icon: 'text-green-500',
		title: 'text-green-800',
	},
	error: {
		bg: 'bg-red-50',
		border: 'border-red-400',
		icon: 'text-red-500',
		title: 'text-red-800',
	},
	warning: {
		bg: 'bg-yellow-50',
		border: 'border-yellow-400',
		icon: 'text-yellow-500',
		title: 'text-yellow-800',
	},
	info: {
		bg: 'bg-blue-50',
		border: 'border-blue-400',
		icon: 'text-blue-500',
		title: 'text-blue-800',
	},
};

// Position classes
const positionClasses = computed(() => {
	switch (props.position) {
		case 'top-left':
			return 'top-4 left-4';
		case 'bottom-right':
			return 'bottom-4 right-4';
		case 'bottom-left':
			return 'bottom-4 left-4';
		default:
			return 'top-4 right-4';
	}
});

function getTypeStyle(type: Toast['type']) {
	return typeStyles[type];
}

function handleDismiss(id: string) {
	const timer = timers.value.get(id);
	if (timer) {
		clearTimeout(timer);
		timers.value.delete(id);
	}
	emit('dismiss', id);
}

// Set up auto-dismiss timers
watch(
	() => props.toasts,
	(newToasts) => {
		for (const toast of newToasts) {
			if (!timers.value.has(toast.id) && toast.duration !== 0) {
				const duration = toast.duration ?? 5000;
				const timer = setTimeout(() => {
					handleDismiss(toast.id);
				}, duration);
				timers.value.set(toast.id, timer);
			}
		}
	},
	{ immediate: true, deep: true }
);

// Cleanup timers on unmount
onUnmounted(() => {
	for (const timer of timers.value.values()) {
		clearTimeout(timer);
	}
	timers.value.clear();
});
</script>

<template>
	<div
		class="fixed z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
		:class="positionClasses"
		data-testid="toast-container"
	>
		<TransitionGroup
			enter-active-class="transition-all duration-300 ease-out"
			leave-active-class="transition-all duration-300 ease-in"
			enter-from-class="opacity-0 translate-x-full"
			leave-to-class="opacity-0 translate-x-full"
			move-class="transition-transform duration-300 ease-in-out"
		>
			<div
				v-for="toast in toasts"
				:key="toast.id"
				class="pointer-events-auto rounded-lg border-l-4 p-4 shadow-lg"
				:class="[getTypeStyle(toast.type).bg, getTypeStyle(toast.type).border]"
				:data-testid="`toast-${toast.id}`"
				role="alert"
			>
				<div class="flex items-start gap-3">
					<!-- Icon -->
					<div :class="getTypeStyle(toast.type).icon" class="flex-shrink-0">
						<!-- Success Icon -->
						<svg
							v-if="toast.type === 'success'"
							class="h-5 w-5"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clip-rule="evenodd"
							/>
						</svg>
						<!-- Error Icon -->
						<svg
							v-else-if="toast.type === 'error'"
							class="h-5 w-5"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
								clip-rule="evenodd"
							/>
						</svg>
						<!-- Warning Icon -->
						<svg
							v-else-if="toast.type === 'warning'"
							class="h-5 w-5"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fill-rule="evenodd"
								d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
								clip-rule="evenodd"
							/>
						</svg>
						<!-- Info Icon -->
						<svg v-else class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>

					<!-- Content -->
					<div class="flex-1 min-w-0">
						<p
							class="text-sm font-medium"
							:class="getTypeStyle(toast.type).title"
						>
							{{ toast.title }}
						</p>
						<p
							v-if="toast.message"
							class="mt-1 text-sm text-gray-600"
						>
							{{ toast.message }}
						</p>
						<button
							v-if="toast.action"
							type="button"
							class="mt-2 text-sm font-medium text-blue-600 hover:text-blue-500"
							@click="toast.action.onClick"
						>
							{{ toast.action.label }}
						</button>
					</div>

					<!-- Dismiss button -->
					<button
						type="button"
						class="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-500 transition-colors"
						@click="handleDismiss(toast.id)"
						aria-label="閉じる"
					>
						<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
				</div>
			</div>
		</TransitionGroup>
	</div>
</template>
