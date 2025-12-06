# Implementation Plan: WebSocket セッションタイムアウト設定

**Branch**: `002-websocket-timeout` | **Date**: 2025-12-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-websocket-timeout/spec.md`

## Summary

Azure Speech Service の従量課金コストを抑制するため、WebSocket セッションに2種類のタイムアウト機能を実装する：
1. **通常タイムアウト**: セッション開始から一定時間（デフォルト15分）で自動終了
2. **無音タイムアウト**: 発話が検出されない状態が一定時間（デフォルト5分）続くと自動終了

両タイマーは独立して動作し、どちらか早い方でセッション終了。環境変数でサービス提供者が設定可能。

## Technical Context

**Language/Version**: TypeScript LTS (strict mode)  
**Primary Dependencies**: ExpressJS 4.x, Nuxt 4, ws (WebSocket)  
**Storage**: N/A (in-memory session state)  
**Testing**: Vitest (unit/integration/contract tests)  
**Target Platform**: Node.js LTS (VOLTA管理)  
**Project Type**: web (frontend + backend monorepo with npm workspaces)  
**Performance Goals**: タイムアウト精度 ±10秒以内、残り時間表示 1秒単位更新  
**Constraints**: サーバー側タイマー管理（クライアント状態非依存）  
**Scale/Scope**: 同時セッション数は既存アーキテクチャに準拠

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ PASS | TDD で実装、タイムアウト機能のユニットテスト・統合テスト作成 |
| II. Technology Stack Compliance | ✅ PASS | 既存スタック（TypeScript, ExpressJS, Nuxt, Vitest）を使用 |
| III. Coding Standards | ✅ PASS | Biome.js でフォーマット、strict TypeScript |
| IV. Secret Management | ✅ PASS | 環境変数で設定、シークレットなし |
| V. Monorepo & Library-First | ✅ PASS | 既存パッケージ構成に準拠（apps/api, apps/web） |

## Project Structure

### Documentation (this feature)

```text
specs/002-websocket-timeout/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── websocket.md     # WebSocket message protocol updates
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/
├── api/
│   ├── src/
│   │   ├── env.d.ts                    # 環境変数型定義（タイムアウト設定追加）
│   │   ├── services/
│   │   │   ├── realtimeService.ts      # 発話検出イベント発火（既存）
│   │   │   └── sessionTimeoutService.ts # 【新規】タイムアウト管理サービス
│   │   └── ws/
│   │       ├── handler.ts              # タイムアウト警告・延長処理追加
│   │       └── index.ts                # セッション管理にタイムアウト統合
│   └── tests/
│       ├── unit/
│       │   └── sessionTimeoutService.test.ts  # 【新規】
│       └── integration/
│           └── timeout.test.ts               # 【新規】
└── web/
    ├── composables/
    │   └── useRealtimeRecognition.ts   # タイムアウト状態・警告処理追加
    ├── components/
    │   ├── SessionTimer.vue            # 【新規】残り時間表示
    │   └── TimeoutWarningModal.vue     # 【新規】警告モーダル
    └── tests/
        └── unit/
            └── SessionTimer.test.ts    # 【新規】
```

**Structure Decision**: 既存のモノレポ構成（apps/api, apps/web, packages/）を維持し、タイムアウト管理サービスを新規追加。

## Complexity Tracking

> No Constitution violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | - | - |
