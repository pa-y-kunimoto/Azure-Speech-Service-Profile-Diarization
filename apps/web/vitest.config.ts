import path from 'node:path';
import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
	test: {
		globals: true,
		environment: 'nuxt',
		include: ['tests/**/*.test.ts'],
		exclude: ['node_modules', 'dist', '.nuxt'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['components/**/*.vue', 'composables/**/*.ts', 'utils/**/*.ts'],
		},
		testTimeout: 10000,
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, '.'),
			'~': path.resolve(__dirname, '.'),
		},
	},
});
