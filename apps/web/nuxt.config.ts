import { defineNuxtConfig } from 'nuxt/config';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: '2024-12-01',
	devtools: { enabled: true },

	devServer: {
		port: process.env.WEB_PORT ? Number.parseInt(process.env.WEB_PORT) : 3002,
	},

	css: ['~/assets/css/tailwind.css'],

	vite: {
		css: {
			postcss: {
				plugins: [
					require('tailwindcss'),
					require('autoprefixer'),
				],
			},
		},
	},

	typescript: {
		strict: true,
		typeCheck: true,
		tsConfig: {
			compilerOptions: {
				target: "ESNext",
				module: "ESNext",
				moduleResolution: "Bundler",
				lib: ["ESNext", "DOM", "DOM.Iterable"],
				jsx: "preserve",
				baseUrl: ".",
				paths: {
					"~/*": ["./*"],
					"@/*": ["./*"]
				},
			},
			include: ["**/*.ts", "**/*.vue", ".nuxt/nuxt.d.ts"],
			exclude: ["node_modules", "dist", ".nuxt", ".output"]
		},
	},

	runtimeConfig: {
		public: {
			apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
		},
	},

	app: {
		head: {
			title: '話者分離・話者認識実験',
			meta: [
				{ charset: 'utf-8' },
				{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
				{
					name: 'description',
					content: 'Azure Speech Service を使用した話者分離・話者認識実験アプリケーション',
				},
			],
		},
	},
});
