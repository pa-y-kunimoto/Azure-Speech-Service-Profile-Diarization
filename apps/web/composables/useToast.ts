/**
 * Toast Notification Composable (T076)
 *
 * Manages toast notifications across the application.
 * Provides methods to show success, error, warning, and info toasts.
 */

import { readonly, ref } from 'vue';

export interface Toast {
	id: string;
	type: 'success' | 'error' | 'warning' | 'info';
	title: string;
	message?: string | undefined;
	duration?: number | undefined;
	action?:
		| {
				label: string;
				onClick: () => void;
		  }
		| undefined;
}

export interface ToastOptions {
	title: string;
	message?: string | undefined;
	duration?: number | undefined;
	action?:
		| {
				label: string;
				onClick: () => void;
		  }
		| undefined;
}

// Global state for toasts
const toasts = ref<Toast[]>([]);

// Generate unique ID
function generateId(): string {
	return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Add a toast to the list
 */
function addToast(type: Toast['type'], options: ToastOptions): string {
	const id = generateId();
	const toast: Toast = {
		id,
		type,
		title: options.title,
		message: options.message,
		duration: options.duration ?? 5000,
		action: options.action,
	};
	toasts.value.push(toast);
	return id;
}

/**
 * Remove a toast by ID
 */
function dismissToast(id: string): void {
	const index = toasts.value.findIndex((t) => t.id === id);
	if (index !== -1) {
		toasts.value.splice(index, 1);
	}
}

/**
 * Clear all toasts
 */
function clearAllToasts(): void {
	toasts.value = [];
}

/**
 * Show a success toast
 */
function success(title: string, message?: string): string {
	return addToast('success', { title, message });
}

/**
 * Show an error toast
 */
function error(title: string, message?: string): string {
	return addToast('error', { title, message, duration: 0 }); // Errors don't auto-dismiss
}

/**
 * Show a warning toast
 */
function warning(title: string, message?: string): string {
	return addToast('warning', { title, message, duration: 7000 });
}

/**
 * Show an info toast
 */
function info(title: string, message?: string): string {
	return addToast('info', { title, message });
}

/**
 * Show a toast with retry action
 */
function errorWithRetry(title: string, message: string, onRetry: () => void): string {
	return addToast('error', {
		title,
		message,
		duration: 0,
		action: {
			label: 'リトライ',
			onClick: () => {
				onRetry();
			},
		},
	});
}

/**
 * Composable for toast notifications
 */
export function useToast() {
	return {
		// State (readonly to prevent external mutation)
		toasts: readonly(toasts),

		// Actions
		success,
		error,
		warning,
		info,
		errorWithRetry,
		dismiss: dismissToast,
		clearAll: clearAllToasts,
	};
}
