````markdown
# Tasks: WebSocket セッションタイムアウト設定

**Input**: Design documents from `/specs/002-websocket-timeout/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/websocket.md

**Tests**: TDD approach per constitution - tests must be written first and fail before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `apps/api/src/`
- **Frontend**: `apps/web/`
- **Tests**: `apps/api/tests/`, `apps/web/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment variable configuration and type definitions

- [X] T001 Add SESSION_TIMEOUT_MINUTES and SILENCE_TIMEOUT_MINUTES to `apps/api/src/env.d.ts`
- [X] T002 [P] Create timeout config parser utility in `apps/api/src/utils/timeoutConfig.ts`
- [X] T003 [P] Add TimeoutState type definitions to `apps/web/composables/useRealtimeRecognition.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core SessionTimeoutService that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational Phase

- [X] T004 Unit tests for SessionTimeoutService in `apps/api/tests/unit/sessionTimeoutService.test.ts`

### Implementation for Foundational Phase

- [X] T005 Create SessionTimeoutService class in `apps/api/src/services/sessionTimeoutService.ts` with:
  - SessionTimeoutConfig interface
  - SessionTimeoutState interface
  - Timer management (start, stop, extend, reset silence)
  - Event emission (onWarning, onTimeout, onTick)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 自動タイムアウトによるコスト保護 (Priority: P1) 🎯 MVP

**Goal**: セッション開始から設定時間（デフォルト15分）経過で自動終了、1分前警告、延長機能

**Independent Test**: タイムアウト時間を短く設定し、セッションが自動終了することを確認

### Tests for User Story 1

- [X] T006 [P] [US1] Integration test for session timeout in `apps/api/tests/integration/timeout.test.ts`

### Implementation for User Story 1

- [X] T007 [US1] Integrate SessionTimeoutService into `apps/api/src/ws/index.ts`:
  - セッション作成時にタイムアウトサービス初期化
  - timeout_status メッセージを1秒ごとにブロードキャスト
  - timeout_warning メッセージ送信（1分前）
  - timeout_ended メッセージ送信とセッションクローズ
- [X] T008 [US1] Add 'extend' action handler to `apps/api/src/ws/handler.ts`:
  - ControlMessage 型に 'extend' アクション追加
  - handleControlMessage に extend 処理追加
  - タイムアウト無効時のエラーハンドリング
- [X] T009 [US1] Update `apps/web/composables/useRealtimeRecognition.ts`:
  - timeout_status, timeout_warning, timeout_ended メッセージハンドリング追加
  - TimeoutState (sessionTimeoutRemaining, warning) を state に追加
  - extendSession() メソッド追加
  - onTimeoutWarning, onTimeoutEnded コールバック追加

**Checkpoint**: セッションタイムアウトが動作し、延長可能

---

## Phase 4: User Story 2 - サービス提供者によるタイムアウト時間の設定 (Priority: P2)

**Goal**: 環境変数で SESSION_TIMEOUT_MINUTES を設定可能、0 で無制限

**Independent Test**: 環境変数を変更してタイムアウト時間が反映されることを確認

### Tests for User Story 2

- [X] T010 [P] [US2] Unit tests for timeout config parsing in `apps/api/tests/unit/timeoutConfig.test.ts`

### Implementation for User Story 2

- [X] T011 [US2] Implement config loading in `apps/api/src/services/sessionTimeoutService.ts`:
  - loadConfig() で環境変数読み込み
  - parseTimeoutMinutes() でバリデーション（1-120分、0=無制限）
  - デフォルト値適用（15分）
- [X] T012 [US2] Load config on WebSocket server startup in `apps/api/src/ws/index.ts`

**Checkpoint**: 環境変数でタイムアウト時間を設定可能

---

## Phase 5: User Story 3 - 残り時間の可視化 (Priority: P3)

**Goal**: 画面上に残り時間を1秒単位で表示、5分未満で強調表示

**Independent Test**: セッション中に残り時間表示がリアルタイムで更新されることを確認

### Tests for User Story 3

- [X] T013 [P] [US3] Unit tests for SessionTimer component in `apps/web/tests/unit/SessionTimer.test.ts`
- [X] T014 [P] [US3] Unit tests for TimeoutWarningModal component in `apps/web/tests/unit/TimeoutWarningModal.test.ts`

### Implementation for User Story 3

- [X] T015 [P] [US3] Create SessionTimer component in `apps/web/components/SessionTimer.vue`:
  - 残り時間表示（MM:SS 形式）
  - 5分未満で色変更（警告色）
  - 1分未満でさらに強調
  - null の場合は「無制限」表示
- [X] T016 [P] [US3] Create TimeoutWarningModal component in `apps/web/components/TimeoutWarningModal.vue`:
  - 警告メッセージ表示
  - 延長ボタン
  - 残り秒数カウントダウン
  - warningType に応じたメッセージ切り替え
- [X] T017 [US3] Integrate SessionTimer and TimeoutWarningModal into `apps/web/pages/session.vue`

**Checkpoint**: 残り時間表示と警告モーダルが動作

---

## Phase 6: User Story 4 - 無音検出による自動セッション終了 (Priority: P2)

**Goal**: 発話が5分間検出されない場合に自動終了、1分前警告、発話でリセット

**Independent Test**: 無音状態を維持してセッションが自動終了することを確認

### Tests for User Story 4

- [X] T018 [P] [US4] Integration test for silence timeout in `apps/api/tests/integration/silenceTimeout.test.ts`

### Implementation for User Story 4

- [X] T019 [US4] Add silence detection to SessionTimeoutService in `apps/api/src/services/sessionTimeoutService.ts`:
  - silenceTimeoutAt, lastSpeechAt, silenceWarningShown フィールド追加
  - resetSilenceTimer() メソッド追加
  - 無音タイムアウト警告・終了イベント発火
- [X] T020 [US4] Connect transcribed event to silence timer in `apps/api/src/ws/index.ts`:
  - service.on('transcribed') で無音タイマーリセット
  - silence timeout_warning, timeout_ended メッセージ送信
- [X] T021 [US4] Update `apps/web/composables/useRealtimeRecognition.ts`:
  - silenceTimeoutRemaining を state に追加
  - 無音警告の表示ハンドリング

**Checkpoint**: 無音タイムアウトが動作

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 最終調整とドキュメント更新

- [X] T022 [P] Add timeout configuration to docker-compose.yml environment section
- [X] T023 [P] Update README.md with timeout configuration documentation
- [X] T024 Run quickstart.md validation (手動テスト)
- [X] T025 Code cleanup: ensure Biome.js formatting passes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2)
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2), can parallel with US1
- **User Story 3 (Phase 5)**: Depends on US1 (needs timeout_status messages)
- **User Story 4 (Phase 6)**: Depends on Foundational (Phase 2), can parallel with US1-3
- **Polish (Phase 7)**: Depends on all user stories

### User Story Dependencies

- **User Story 1 (P1)**: MVP - core timeout functionality
- **User Story 2 (P2)**: Environment variable configuration - enhances US1
- **User Story 3 (P3)**: UI for remaining time - depends on US1
- **User Story 4 (P2)**: Silence detection - independent of US1-3 but same service

### Within Each Phase

- Tests MUST be written and FAIL before implementation
- Service layer before integration layer
- Backend before frontend integration

### Parallel Opportunities

- T002, T003 can run in parallel (Setup phase)
- T006 (US1 test) can run parallel with T010 (US2 test), T013, T014 (US3 tests), T018 (US4 test)
- T015, T016 can run in parallel (different Vue components)

---

## Parallel Example: Setup Phase

```bash
# Launch all setup tasks together:
Task: "Add env types in apps/api/src/env.d.ts" (T001)
Task: "Create timeout config parser in apps/api/src/utils/timeoutConfig.ts" (T002)
Task: "Add TimeoutState types in apps/web/composables/useRealtimeRecognition.ts" (T003)
```

## Parallel Example: Test Phase

```bash
# Launch all user story tests together after Foundational:
Task: "Integration test for session timeout" (T006)
Task: "Unit tests for timeout config parsing" (T010)
Task: "Unit tests for SessionTimer component" (T013)
Task: "Unit tests for TimeoutWarningModal component" (T014)
Task: "Integration test for silence timeout" (T018)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (SessionTimeoutService)
3. Complete Phase 3: User Story 1 (auto-timeout with extend)
4. **STOP and VALIDATE**: Test session timeout works
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test session timeout → MVP!
3. Add User Story 2 → Test env config → Deploy
4. Add User Story 4 → Test silence timeout → Deploy
5. Add User Story 3 → Test UI display → Deploy
6. Polish → Final deployment

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 + User Story 3 (backend → UI flow)
   - Developer B: User Story 2 + User Story 4 (config + silence detection)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- タイムアウト精度は ±10秒以内を目標
- 警告は1分前（±5秒）に表示
- 環境変数 0 = 無制限（タイムアウト無効）

````
