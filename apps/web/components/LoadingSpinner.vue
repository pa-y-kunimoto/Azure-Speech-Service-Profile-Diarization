<script setup lang="ts">
/**
 * LoadingSpinner Component (T077)
 *
 * A reusable loading spinner with optional text and sizes.
 */

withDefaults(
	defineProps<{
		size?: 'sm' | 'md' | 'lg' | 'xl';
		text?: string;
		fullScreen?: boolean;
	}>(),
	{
		size: 'md',
		text: '',
		fullScreen: false,
	}
);

const sizeClasses = {
	sm: 'h-4 w-4',
	md: 'h-8 w-8',
	lg: 'h-12 w-12',
	xl: 'h-16 w-16',
};

const textSizeClasses = {
	sm: 'text-sm',
	md: 'text-base',
	lg: 'text-lg',
	xl: 'text-xl',
};
</script>

<template>
	<div
		:class="[
			'flex flex-col items-center justify-center gap-3',
			fullScreen ? 'fixed inset-0 bg-white/80 backdrop-blur-sm z-50' : '',
		]"
		role="status"
		aria-live="polite"
	>
		<svg
			:class="['animate-spin text-blue-600', sizeClasses[size]]"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
		>
			<circle
				class="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				stroke-width="4"
			/>
			<path
				class="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			/>
		</svg>
		<span
			v-if="text"
			:class="['text-gray-600', textSizeClasses[size]]"
		>
			{{ text }}
		</span>
		<span class="sr-only">読み込み中...</span>
	</div>
</template>
