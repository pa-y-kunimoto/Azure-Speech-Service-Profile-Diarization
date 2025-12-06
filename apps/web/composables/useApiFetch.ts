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
	const { $config } = useNuxtApp();

	// SSR時は内部URL、クライアント時は外部URLを使用
	const baseURL = import.meta.client
		? $config.public.apiExternalUrl || $config.public.apiBaseUrl
		: $config.public.apiBaseUrl;

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
	 * Always uses external URL since WebSocket is client-side only
	 */
	function getWebSocketUrl(endpoint: string): string {
		const externalUrl = $config.public.apiExternalUrl || $config.public.apiBaseUrl;
		const wsProtocol = externalUrl.startsWith('https') ? 'wss' : 'ws';
		const host = externalUrl.replace(/^https?:\/\//, '');
		return `${wsProtocol}://${host}${endpoint}`;
	}

	return {
		apiFetch,
		getBaseUrl,
		getWebSocketUrl,
	};
}
