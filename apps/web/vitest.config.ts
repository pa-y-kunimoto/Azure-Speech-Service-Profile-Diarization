import path from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [vue()],
	test: {
		globals: true,
		environment: 'happy-dom',
		include: ['tests/**/*.test.ts'],
		exclude: ['node_modules', 'dist', '.nuxt'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['components/**/*.vue', 'composables/**/*.ts', 'utils/**/*.ts'],
		},
		testTimeout: 10000,
		isolate: true,
		pool: 'forks',
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, '.'),
			'~': path.resolve(__dirname, '.'),
			'#app': path.resolve(__dirname, '.nuxt/imports.d.ts'),
			'#imports': path.resolve(__dirname, '.nuxt/imports.d.ts'),
		},
	},
});
