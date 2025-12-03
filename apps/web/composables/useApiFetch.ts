/**
 * useApiFetch composable
 * Provides a configured $fetch instance with API base URL
 *
 * Usage:
 *   const { apiFetch } = useApiFetch()
 *   const data = await apiFetch<T>('/endpoint', options)
 */

import type { NitroFetchOptions } from 'nitropack';
import { useNuxtApp } from 'nuxt/app';

export function useApiFetch() {
	const {$config} = useNuxtApp();
	const baseURL = $config.public.apiBaseUrl;

	/**
	 * Fetch wrapper with API base URL configured
	 */
	async function apiFetch<T>(
		endpoint: string,
		options?: Omit<NitroFetchOptions<string>, 'baseURL'>
	): Promise<T> {
		return $fetch<T>(endpoint, {
			...options,
			baseURL,
		});
	}

	/**
	 * Get the configured base URL
	 */
	function getBaseUrl(): string {
		return baseURL;
	}

	/**
	 * Build full WebSocket URL for an endpoint
	 */
	function getWebSocketUrl(endpoint: string): string {
		const wsProtocol = baseURL.startsWith('https') ? 'wss' : 'ws';
		const host = baseURL.replace(/^https?:\/\//, '');
		return `${wsProtocol}://${host}${endpoint}`;
	}

	return {
		apiFetch,
		getBaseUrl,
		getWebSocketUrl,
	};
}
