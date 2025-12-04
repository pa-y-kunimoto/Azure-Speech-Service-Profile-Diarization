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
			apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:3001',
			// クライアントサイド（ブラウザ）からの接続先
			// Docker環境ではコンテナ外からアクセスするため別URLが必要
			apiExternalUrl: process.env.NUXT_PUBLIC_API_EXTERNAL_URL || process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:3001',
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

	nitro: {
		// node-server プリセットを明示的に指定
		preset: 'node-server',
		// 静的アセットの設定
		publicAssets: [
			{
				dir: 'public',
				baseURL: '/',
			},
		],
	},
});
