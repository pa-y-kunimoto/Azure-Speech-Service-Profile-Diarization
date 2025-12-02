# Speaker Diarization Web App

Nuxt 4 ベースの話者分離・話者認識実験フロントエンド。

## 概要

ユーザーが音声プロフィールを管理し、リアルタイムで話者認識を行うためのWebアプリケーション。

## 機能

- **音声プロフィール管理**
  - WAV/MP3ファイルのアップロード
  - ブラウザマイクでの録音
  - プロフィールの一覧表示・削除

- **話者分離セッション**
  - プロフィール選択・Azure登録
  - リアルタイム音声認識
  - 話者名付きテキスト表示

- **セッション結果**
  - タイムラインビュー
  - 話者別フィルタリング
  - 発話統計

## ページ構成

| パス | ページ | 説明 |
|------|--------|------|
| `/` | index.vue | プロフィール管理 |
| `/session` | session.vue | 話者分離セッション |

## コンポーネント

| コンポーネント | 説明 |
|---------------|------|
| `VoiceProfileUploader` | ファイルアップロード |
| `VoiceRecorder` | ブラウザ録音 |
| `ProfileList` | プロフィール一覧 |
| `SessionControl` | セッション管理 |
| `TranscriptView` | リアルタイム発話表示 |
| `SpeakerTimeline` | タイムラインビュー |

## Composables

| Composable | 説明 |
|------------|------|
| `useVoiceProfile` | プロフィールCRUD |
| `useAudioRecorder` | 録音機能 |
| `useDiarizationSession` | セッション管理 |
| `useRealtimeRecognition` | リアルタイム認識 |

## 開発

### 起動

```bash
# 開発モード
npm run dev --workspace=apps/web

# 本番ビルド
npm run build --workspace=apps/web
```

### テスト

```bash
# ユニットテスト
npm test --workspace=apps/web

# E2Eテスト
npm run test:e2e --workspace=apps/web
```

## ディレクトリ構成

```
apps/web/
├── app.vue
├── nuxt.config.ts
├── tailwind.config.ts
├── pages/
│   ├── index.vue
│   └── session.vue
├── components/
│   ├── VoiceProfileUploader.vue
│   ├── VoiceRecorder.vue
│   ├── ProfileList.vue
│   ├── SessionControl.vue
│   ├── TranscriptView.vue
│   └── SpeakerTimeline.vue
├── composables/
│   ├── useVoiceProfile.ts
│   ├── useAudioRecorder.ts
│   ├── useDiarizationSession.ts
│   └── useRealtimeRecognition.ts
├── utils/
│   ├── audioConverter.ts
│   └── wavEncoder.ts
└── tests/
    ├── unit/
    └── e2e/
```

## 技術スタック

- Nuxt 4 / Vue 3
- TailwindCSS
- TypeScript
- Vitest / Playwright
