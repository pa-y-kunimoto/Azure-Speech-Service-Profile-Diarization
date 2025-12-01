# Implementation Plan: 話者分離・話者認識実験アプリケーション

**Branch**: `001-speaker-diarization-experiment` | **Date**: 2025-12-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-speaker-diarization-experiment/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command.

## Summary

Azure Speech Service の話者分離（Diarization）機能を活用して、事前登録した音声プロフィールに基づく話者認識を実験するWebアプリケーション。ユーザーは音声ファイルのアップロードまたはブラウザ録音でプロフィールを作成し、リアルタイムで話者を識別できる。

## Technical Context

**Language/Version**: TypeScript 5.x LTS（Node.js 22.x LTS）  
**Primary Dependencies**: Nuxt 4（フロントエンド）、ExpressJS 4.x（バックエンド）、microsoft-cognitiveservices-speech-sdk  
**Storage**: Session Storage（クライアント）、音声ファイルは Blob として一時保持  
**Testing**: Vitest（ユニット/統合テスト）、Playwright（E2Eテスト）  
**Target Platform**: Webブラウザ（Chrome/Edge/Safari/Firefox 最新版）  
**Project Type**: Monorepo Web Application（フロントエンド + バックエンド + 共通ライブラリ）  
**Performance Goals**: リアルタイム認識遅延 < 3秒、プロフィール登録 < 10秒/件  
**Constraints**: セッションストレージ上限（5-10MB）、マイクアクセス権限必須  
**Scale/Scope**: 実験用途、同時話者3人以上、セッション10分以上安定動作

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Test-First Development (NON-NEGOTIABLE)

| 項目 | 状態 | 備考 |
|------|------|------|
| TDD Red-Green-Refactor | ✅ PASS | 各ユーザーストーリーにテストフェーズを設計 |
| 古典派 TDD 優先 | ✅ PASS | 実オブジェクト使用、モックは Azure SDK のみ |
| モックは最終手段 | ✅ PASS | Azure Speech Service との接続部分のみモック許可 |
| 80% カバレッジ | ✅ PASS | Vitest でカバレッジ測定 |
| テスト独立性 | ✅ PASS | 各テストは単独実行可能に設計 |

### II. Technology Stack Compliance

| 項目 | 状態 | 備考 |
|------|------|------|
| Node.js LTS (VOLTA) | ✅ PASS | Node.js 22.x LTS を使用 |
| TypeScript LTS (strict) | ✅ PASS | TypeScript 5.x、strict モード有効 |
| Nuxt 4 (フロントエンド) | ✅ PASS | apps/web で使用 |
| ExpressJS (バックエンド) | ✅ PASS | apps/api で使用 |
| TailwindCSS | ✅ PASS | フロントエンドスタイリング |
| npm workspaces | ✅ PASS | モノレポ構成 |

### III. Coding Standards

| 項目 | 状態 | 備考 |
|------|------|------|
| Biome.js フォーマッター | ✅ PASS | プロジェクトルートで設定 |
| TypeScript strict | ✅ PASS | any 禁止、型安全性確保 |
| 命名規則 | ✅ PASS | camelCase/PascalCase 遵守 |
| 1ファイル1責務 | ✅ PASS | 機能ごとにモジュール化 |

### IV. Secret Management

| 項目 | 状態 | 備考 |
|------|------|------|
| 環境変数管理 | ✅ PASS | Azure Speech API キーは環境変数 |
| .env を .gitignore | ✅ PASS | 設定済み |
| .env.example 提供 | ✅ PASS | 必要変数テンプレート作成 |
| ハードコーディング禁止 | ✅ PASS | シークレットはコードに含めない |

### V. Monorepo & Library-First

| 項目 | 状態 | 備考 |
|------|------|------|
| packages/ 配下に配置 | ✅ PASS | packages/core, packages/speech-client |
| 循環依存禁止 | ✅ PASS | 依存方向を一方向に設計 |
| 独立テスト | ✅ PASS | 各パッケージに tests/ |
| パッケージ README | ✅ PASS | 各パッケージにドキュメント |

**Constitution Check Result**: ✅ ALL PASS - Phase 0 に進行可能

## Project Structure

### Documentation (this feature)

```text
specs/001-speaker-diarization-experiment/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
│   └── api.yaml         # OpenAPI specification
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root - Monorepo)

```text
/
├── package.json              # ルート package.json (npm workspaces)
├── biome.json                # Biome.js 設定
├── tsconfig.base.json        # 共通 TypeScript 設定
├── volta.json                # VOLTA バージョン管理（新規作成）
├── .env.example              # 環境変数テンプレート
│
├── apps/
│   ├── web/                  # Nuxt 4 フロントエンド
│   │   ├── package.json
│   │   ├── nuxt.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── app.vue
│   │   ├── pages/
│   │   │   ├── index.vue           # ホーム（プロフィール管理）
│   │   │   └── session.vue         # 話者分離セッション
│   │   ├── components/
│   │   │   ├── VoiceProfileUploader.vue
│   │   │   ├── VoiceRecorder.vue
│   │   │   ├── ProfileList.vue
│   │   │   ├── SessionControl.vue
│   │   │   ├── TranscriptView.vue
│   │   │   └── SpeakerTimeline.vue
│   │   ├── composables/
│   │   │   ├── useVoiceProfile.ts
│   │   │   ├── useAudioRecorder.ts
│   │   │   └── useDiarizationSession.ts
│   │   └── tests/
│   │       ├── unit/
│   │       └── e2e/
│   │
│   └── api/                  # ExpressJS バックエンド
│       ├── package.json
│       ├── src/
│       │   ├── index.ts            # エントリーポイント
│       │   ├── routes/
│       │   │   └── speech.ts       # /api/speech エンドポイント
│       │   ├── services/
│       │   │   └── speechService.ts
│       │   └── middleware/
│       │       └── errorHandler.ts
│       └── tests/
│           ├── unit/
│           └── integration/
│
├── packages/
│   ├── core/                 # 共通型定義・ユーティリティ（既存）
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types/
│   │   │   │   ├── voiceProfile.ts
│   │   │   │   ├── diarizationSession.ts
│   │   │   │   ├── speakerMapping.ts
│   │   │   │   └── utterance.ts
│   │   │   └── utils/
│   │   │       └── validation.ts
│   │   └── tests/
│   │
│   └── speech-client/        # Azure Speech Service クライアント
│       ├── package.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── diarizationClient.ts
│       │   ├── audioProcessor.ts
│       │   └── speakerRecognizer.ts
│       └── tests/
│           ├── unit/
│           └── integration/
│
└── .specify/                 # Speckit 設定（既存）
```

**Structure Decision**: Monorepo (npm workspaces) を採用。Constitution の「Monorepo & Library-First」原則に準拠。

- **apps/web**: Nuxt 4 フロントエンド（ユーザーインターフェース）
- **apps/api**: ExpressJS バックエンド（Azure Speech Service プロキシ）
- **packages/core**: 共通型定義・ユーティリティ
- **packages/speech-client**: Azure Speech SDK ラッパー

この構成により、フロントエンド・バックエンド・共通ライブラリが独立して開発・テスト可能。

## Complexity Tracking

> Constitution Check は全て PASS のため、違反の正当化は不要。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| なし | - | - |

---

## Constitution Re-Check (Post-Design)

*Phase 1 設計完了後の再評価*

### 設計成果物の確認

| 成果物 | 状態 | ファイル |
|--------|------|----------|
| research.md | ✅ 完了 | [research.md](./research.md) |
| data-model.md | ✅ 完了 | [data-model.md](./data-model.md) |
| contracts/api.yaml | ✅ 完了 | [contracts/api.yaml](./contracts/api.yaml) |
| contracts/websocket.md | ✅ 完了 | [contracts/websocket.md](./contracts/websocket.md) |
| quickstart.md | ✅ 完了 | [quickstart.md](./quickstart.md) |

### 設計と Constitution の整合性

| 原則 | 設計での対応 | 状態 |
|------|-------------|------|
| I. TDD | Vitest + Playwright、モックは Azure SDK のみ | ✅ PASS |
| II. Tech Stack | Nuxt 4, ExpressJS, TypeScript, VOLTA | ✅ PASS |
| III. Coding Standards | Biome.js、strict TypeScript | ✅ PASS |
| IV. Secret Management | 環境変数、.env.example 提供 | ✅ PASS |
| V. Monorepo | apps/ + packages/ 構成 | ✅ PASS |

### 依存関係の確認

```
packages/core (型定義)
    ↑
packages/speech-client (Azure SDK ラッパー)
    ↑
apps/api (バックエンド)
    ↑
apps/web (フロントエンド)
```

- 循環依存: なし ✅
- 依存方向: 一方向 ✅

**Constitution Re-Check Result**: ✅ ALL PASS - Phase 2 (tasks) に進行可能
