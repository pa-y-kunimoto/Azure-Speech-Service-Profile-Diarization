<script setup lang="ts">
/**
 * LoadingOverlay Component (T077)
 *
 * Displays a loading overlay over content with optional message.
 */

withDefaults(
	defineProps<{
		show: boolean;
		message?: string;
		blur?: boolean;
	}>(),
	{
		message: '処理中...',
		blur: true,
	}
);
</script>

<template>
	<div class="relative">
		<!-- Slot content -->
		<slot />

		<!-- Overlay -->
		<Transition name="fade">
			<div
				v-if="show"
				class="absolute inset-0 flex items-center justify-center z-10"
				:class="blur ? 'bg-white/70 backdrop-blur-sm' : 'bg-white/90'"
			>
				<LoadingSpinner :text="message" size="lg" />
			</div>
		</Transition>
	</div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
