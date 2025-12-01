# Tasks: 話者分離・話者認識実験アプリケーション

**Input**: Design documents from `/specs/001-speaker-diarization-experiment/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Constitution I で TDD が必須のため、各ユーザーストーリーにテストタスクを含む

**Organization**: ユーザーストーリー（P1→P5）順に整理。各ストーリーは独立して実装・テスト可能

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 並列実行可能（異なるファイル、依存なし）
- **[Story]**: ユーザーストーリー（US1, US2, US3, US4, US5）

---

## Phase 1: Setup (プロジェクト初期化)

**Purpose**: Monorepo 構成の初期化と開発環境セットアップ

- [ ] T001 VOLTA バージョン設定ファイル volta.json を作成（Node.js 22.x LTS 指定）
- [ ] T002 ルート package.json に npm workspaces 設定（apps/web, apps/api, packages/core, packages/speech-client）
- [ ] T003 [P] Biome.js 設定ファイル biome.json を作成
- [ ] T004 [P] 共通 TypeScript 設定 tsconfig.base.json を更新（strict モード）
- [ ] T005 [P] 環境変数テンプレート .env.example を作成（SPEECH_KEY, SPEECH_ENDPOINT）
- [ ] T006 [P] .gitignore に .env を追加
- [ ] T007 Nuxt 4 フロントエンド apps/web を初期化（package.json, nuxt.config.ts）
- [ ] T008 TailwindCSS 設定 apps/web/tailwind.config.ts を作成
- [ ] T009 ExpressJS バックエンド apps/api を初期化（package.json, tsconfig.json）
- [ ] T010 [P] packages/core を初期化（package.json, tsconfig.json）
- [ ] T011 [P] packages/speech-client を初期化（package.json, tsconfig.json, microsoft-cognitiveservices-speech-sdk 依存追加）

---

## Phase 2: Foundational (共通基盤)

**Purpose**: 全ユーザーストーリーが依存する共通型定義・インフラ

**⚠️ CRITICAL**: このフェーズ完了まで、ユーザーストーリーの実装は開始不可

### Core 型定義

- [ ] T012 [P] VoiceProfile 型定義を作成 packages/core/src/types/voiceProfile.ts
- [ ] T013 [P] DiarizationSession 型定義を作成 packages/core/src/types/diarizationSession.ts
- [ ] T014 [P] SpeakerMapping 型定義を作成 packages/core/src/types/speakerMapping.ts
- [ ] T015 [P] Utterance 型定義を作成 packages/core/src/types/utterance.ts
- [ ] T016 型定義のエクスポートを整理 packages/core/src/index.ts

### バックエンド基盤

- [ ] T017 ExpressJS エントリーポイント apps/api/src/index.ts を作成（CORS, JSON パーサー設定）
- [ ] T018 [P] エラーハンドラーミドルウェア apps/api/src/middleware/errorHandler.ts を作成
- [ ] T019 [P] ヘルスチェックエンドポイント apps/api/src/routes/health.ts を作成（/api/health）

### フロントエンド基盤

- [ ] T020 apps/web/app.vue レイアウト作成（TailwindCSS ベース）
- [ ] T021 [P] ページルーティング設定 apps/web/pages/index.vue（プロフィール管理）
- [ ] T022 [P] ページルーティング設定 apps/web/pages/session.vue（話者分離セッション）

### テスト環境

- [ ] T023 [P] Vitest 設定 apps/api/vitest.config.ts
- [ ] T024 [P] Vitest 設定 apps/web/vitest.config.ts
- [ ] T025 [P] Vitest 設定 packages/core/vitest.config.ts
- [ ] T026 [P] Playwright 設定 apps/web/playwright.config.ts

**Checkpoint**: 基盤完了 - 全 apps/packages がビルド可能、型定義が利用可能

---

## Phase 3: User Story 1 - 音声プロフィール作成（アップロード） (Priority: P1) 🎯 MVP

**Goal**: ユーザーが WAV/MP3 ファイルをアップロードして音声プロフィールを作成・管理できる

**Independent Test**: 音声ファイルをアップロードし、プロフィール一覧に表示されることを確認

### Tests for User Story 1 ⚠️

> **NOTE: TDD - これらのテストを先に書き、FAIL を確認してから実装**

- [ ] T027 [P] [US1] VoiceProfile バリデーション単体テスト packages/core/tests/unit/voiceProfile.test.ts
- [ ] T028 [P] [US1] useVoiceProfile composable 単体テスト apps/web/tests/unit/useVoiceProfile.test.ts
- [ ] T029 [P] [US1] VoiceProfileUploader コンポーネントテスト apps/web/tests/unit/VoiceProfileUploader.test.ts
- [ ] T030 [P] [US1] ProfileList コンポーネントテスト apps/web/tests/unit/ProfileList.test.ts

### Implementation for User Story 1

- [ ] T031 [US1] VoiceProfile バリデーションユーティリティ packages/core/src/utils/validation.ts（名前1-50文字、音声5秒以上）
- [ ] T032 [US1] useVoiceProfile composable apps/web/composables/useVoiceProfile.ts（sessionStorage CRUD、容量チェック・警告表示ロジック含む）
- [ ] T033 [US1] 音声ファイル → Base64 変換ユーティリティ apps/web/utils/audioConverter.ts（MP3→WAV 変換含む、WAV 16kHz/16-bit/Mono 正規化）
- [ ] T034 [US1] VoiceProfileUploader コンポーネント apps/web/components/VoiceProfileUploader.vue（ファイル選択、名前入力、バリデーション表示）
- [ ] T035 [US1] ProfileList コンポーネント apps/web/components/ProfileList.vue（一覧表示、削除ボタン、再生プレビュー）
- [ ] T036 [US1] index.vue にコンポーネントを統合 apps/web/pages/index.vue

**Checkpoint**: US1 完了 - 音声ファイルをアップロードし、セッションストレージに保存・一覧表示・削除が可能

---

## Phase 4: User Story 2 - 音声プロフィール作成（ブラウザ録音） (Priority: P2)

**Goal**: ユーザーがブラウザマイクで録音して音声プロフィールを作成できる

**Independent Test**: 録音ボタンを押して音声を録音し、プロフィールとして保存できることを確認

### Tests for User Story 2 ⚠️

- [ ] T037 [P] [US2] useAudioRecorder composable 単体テスト apps/web/tests/unit/useAudioRecorder.test.ts（MediaRecorder モック）
- [ ] T038 [P] [US2] VoiceRecorder コンポーネントテスト apps/web/tests/unit/VoiceRecorder.test.ts

### Implementation for User Story 2

- [ ] T039 [US2] useAudioRecorder composable apps/web/composables/useAudioRecorder.ts（MediaRecorder, Web Audio API, WAV 変換）
- [ ] T040 [US2] WAV エンコーダーユーティリティ apps/web/utils/wavEncoder.ts（16kHz, 16-bit, Mono）
- [ ] T041 [US2] VoiceRecorder コンポーネント apps/web/components/VoiceRecorder.vue（録音開始/停止、プレビュー再生、保存）
- [ ] T042 [US2] index.vue に VoiceRecorder を追加 apps/web/pages/index.vue（タブ切り替え: アップロード/録音）

**Checkpoint**: US2 完了 - ブラウザマイクで録音し、音声プロフィールとして保存が可能

---

## Phase 5: User Story 3 - セッション開始・話者登録 (Priority: P3)

**Goal**: 選択した音声プロフィールを Azure に送信し、speakerId を取得・マッピング表示

**Independent Test**: プロフィールを選択してセッション開始、各プロフィールに speakerId が割り当てられることを確認

### Tests for User Story 3 ⚠️

- [ ] T043 [P] [US3] セッション作成 API コントラクトテスト apps/api/tests/contract/session.test.ts（POST /api/session）
- [ ] T044 [P] [US3] プロフィール登録 API コントラクトテスト apps/api/tests/contract/registerProfile.test.ts（POST /api/session/{id}/register-profile）
- [ ] T045 [P] [US3] SpeechService 単体テスト packages/speech-client/tests/unit/speechService.test.ts（Azure SDK モック）
- [ ] T046 [P] [US3] useDiarizationSession composable テスト apps/web/tests/unit/useDiarizationSession.test.ts
- [ ] T047 [P] [US3] SessionControl コンポーネントテスト apps/web/tests/unit/SessionControl.test.ts

### Implementation for User Story 3

#### Speech Client パッケージ

- [ ] T048 [US3] DiarizationClient クラス packages/speech-client/src/diarizationClient.ts（ConversationTranscriber ラッパー）
- [ ] T049 [US3] AudioProcessor クラス packages/speech-client/src/audioProcessor.ts（PushStream 管理）
- [ ] T050 [US3] speech-client エクスポート packages/speech-client/src/index.ts

#### バックエンド API

- [ ] T051 [US3] SpeechService apps/api/src/services/speechService.ts（Azure SDK 接続、セッション管理）
- [ ] T052 [US3] セッションルート apps/api/src/routes/session.ts（POST /api/session, GET /api/session/{id}, DELETE /api/session/{id}）
- [ ] T053 [US3] プロフィール登録ルート apps/api/src/routes/speech.ts（POST /api/session/{id}/register-profile）
- [ ] T054 [US3] ルーティング統合 apps/api/src/index.ts（session, speech ルートを追加）

#### フロントエンド

- [ ] T055 [US3] useDiarizationSession composable apps/web/composables/useDiarizationSession.ts（セッション状態管理、API 呼び出し）
- [ ] T056 [US3] SessionControl コンポーネント apps/web/components/SessionControl.vue（プロフィール選択、開始ボタン、speakerId マッピング表示）
- [ ] T057 [US3] session.vue にコンポーネントを統合 apps/web/pages/session.vue

**Checkpoint**: US3 完了 - プロフィール選択 → Azure セッション開始 → speakerId マッピング表示が可能

---

## Phase 6: User Story 4 - リアルタイム話者認識 (Priority: P4)

**Goal**: マイク入力をリアルタイムで Azure に送信し、話者名付きでテキスト表示

**Independent Test**: セッション開始後にマイクで話すと、話者名とテキストがリアルタイム表示されることを確認

### Tests for User Story 4 ⚠️

- [ ] T058 [P] [US4] WebSocket メッセージハンドラーテスト apps/api/tests/unit/wsHandler.test.ts
- [ ] T059 [P] [US4] リアルタイム認識統合テスト apps/api/tests/integration/realtime.test.ts（Azure SDK モック）
- [ ] T060 [P] [US4] TranscriptView コンポーネントテスト apps/web/tests/unit/TranscriptView.test.ts

### Implementation for User Story 4

#### バックエンド WebSocket

- [ ] T061 [US4] WebSocket サーバー設定 apps/api/src/ws/index.ts（ws パッケージ）
- [ ] T062 [US4] WebSocket メッセージハンドラー apps/api/src/ws/handler.ts（audio, control メッセージ処理）
- [ ] T063 [US4] リアルタイム文字起こしサービス apps/api/src/services/realtimeService.ts（PushStream 連携）
- [ ] T064 [US4] WebSocket ルート統合 apps/api/src/index.ts（/ws/session/{id}）

#### フロントエンド

- [ ] T065 [US4] useRealtimeRecognition composable apps/web/composables/useRealtimeRecognition.ts（WebSocket 接続、マイク入力送信）
- [ ] T066 [US4] TranscriptView コンポーネント apps/web/components/TranscriptView.vue（リアルタイムテキスト表示、話者名表示）
- [ ] T067 [US4] session.vue に TranscriptView を統合 apps/web/pages/session.vue（開始/停止ボタン）

**Checkpoint**: US4 完了 - リアルタイムで話者名付きテキストが表示される

---

## Phase 7: User Story 5 - セッション結果確認 (Priority: P5)

**Goal**: セッション終了後、発話履歴をタイムライン形式で確認

**Independent Test**: セッション終了後に発話履歴が時系列で表示されることを確認

### Tests for User Story 5 ⚠️

- [ ] T068 [P] [US5] SpeakerTimeline コンポーネントテスト apps/web/tests/unit/SpeakerTimeline.test.ts

### Implementation for User Story 5

- [ ] T069 [US5] SpeakerTimeline コンポーネント apps/web/components/SpeakerTimeline.vue（タイムライン表示、話者フィルタ）
- [ ] T070 [US5] session.vue に結果表示セクションを追加 apps/web/pages/session.vue（セッション終了時に SpeakerTimeline 表示）

**Checkpoint**: US5 完了 - 全発話がタイムライン形式で確認可能

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 品質向上、ドキュメント、最終検証

- [ ] T071 [P] README.md 更新（セットアップ手順、使用方法）
- [ ] T072 [P] apps/api/README.md 作成（API ドキュメント）
- [ ] T073 [P] apps/web/README.md 作成（フロントエンドドキュメント）
- [ ] T074 [P] packages/core/README.md 作成
- [ ] T075 [P] packages/speech-client/README.md 作成
- [ ] T076 エラーハンドリングの統一（Toast 通知、リトライロジック、WebSocket 自動再接続ロジック）
- [ ] T077 ローディング状態の UI 改善
- [ ] T078 quickstart.md に従った E2E 動作確認
- [ ] T079 [P] Playwright E2E テスト apps/web/tests/e2e/fullFlow.test.ts（プロフィール作成 → セッション → 認識 → 結果確認）

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (BLOCKS all user stories)
    ↓
┌───────────────────────────────────────────────┐
│  Phase 3: US1 (P1) 🎯 MVP                     │
│      ↓                                        │
│  Phase 4: US2 (P2) ← US1 の UI を拡張         │
│      ↓                                        │
│  Phase 5: US3 (P3) ← US1/US2 のプロフィール使用│
│      ↓                                        │
│  Phase 6: US4 (P4) ← US3 のセッション使用     │
│      ↓                                        │
│  Phase 7: US5 (P5) ← US4 の発話データ使用     │
└───────────────────────────────────────────────┘
    ↓
Phase 8: Polish
```

### User Story Dependencies

| Story | 依存関係 | 独立テスト可否 |
|-------|----------|---------------|
| US1 | Phase 2 のみ | ✅ 完全独立 (MVP) |
| US2 | US1 の UI フレームを使用 | ✅ US1 完了後独立 |
| US3 | US1/US2 で作成したプロフィール使用 | ✅ プロフィールがあれば独立 |
| US4 | US3 のセッション使用 | ✅ セッション開始後独立 |
| US5 | US4 の発話履歴使用 | ✅ 発話データがあれば独立 |

### Within Each User Story

1. テストを書き、FAIL を確認
2. Model/Type → Service/Composable → Component → Page 統合
3. テストが PASS することを確認
4. Checkpoint で独立動作を検証

---

## Parallel Execution Examples

### Phase 1: Setup（並列可能タスク）

```bash
# 以下は同時実行可能
T003 [P] Biome.js 設定
T004 [P] tsconfig.base.json 更新
T005 [P] .env.example 作成
T006 [P] .gitignore 更新
T010 [P] packages/core 初期化
T011 [P] packages/speech-client 初期化
```

### Phase 2: Foundational（並列可能タスク）

```bash
# 型定義は同時実行可能
T012 [P] VoiceProfile 型
T013 [P] DiarizationSession 型
T014 [P] SpeakerMapping 型
T015 [P] Utterance 型

# テスト環境は同時実行可能
T023 [P] apps/api Vitest
T024 [P] apps/web Vitest
T025 [P] packages/core Vitest
T026 [P] Playwright 設定
```

### Phase 3: User Story 1（並列可能タスク）

```bash
# テストは同時実行可能（TDD: 先に書く）
T027 [P] [US1] VoiceProfile バリデーションテスト
T028 [P] [US1] useVoiceProfile テスト
T029 [P] [US1] VoiceProfileUploader テスト
T030 [P] [US1] ProfileList テスト
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. **Phase 1**: Setup 完了
2. **Phase 2**: Foundational 完了
3. **Phase 3**: User Story 1 完了
4. **VALIDATE**: 音声ファイルアップロード → 保存 → 一覧表示 → 削除
5. **Deploy/Demo**: MVP として動作確認

### Incremental Delivery

| リリース | 含まれるストーリー | 提供価値 |
|----------|-------------------|----------|
| MVP | US1 | 音声プロフィール管理（アップロード） |
| v0.2 | US1 + US2 | ブラウザ録音も追加 |
| v0.3 | US1-3 | Azure 連携、speakerId 取得 |
| v0.4 | US1-4 | リアルタイム話者認識 |
| v1.0 | US1-5 | タイムライン表示で完全版 |

---

## Summary

| カテゴリ | タスク数 |
|----------|---------|
| Phase 1: Setup | 11 タスク |
| Phase 2: Foundational | 15 タスク |
| Phase 3: US1 (P1) MVP | 10 タスク |
| Phase 4: US2 (P2) | 6 タスク |
| Phase 5: US3 (P3) | 15 タスク |
| Phase 6: US4 (P4) | 10 タスク |
| Phase 7: US5 (P5) | 3 タスク |
| Phase 8: Polish | 9 タスク |
| **合計** | **79 タスク** |

---

## Notes

- [P] タスク = 異なるファイル、依存なし、並列実行可能
- [USx] ラベル = ユーザーストーリーとの紐付け
- 各 Checkpoint で独立動作を検証してから次へ
- Constitution I に従い、テストは実装前に書く（TDD）
- Azure SDK モックは packages/speech-client テストでのみ使用（古典派 TDD）
