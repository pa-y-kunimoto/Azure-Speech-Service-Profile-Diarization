# Feature Specification: Nuxt4 Upgrade

**Feature Branch**: `001-nuxt-upgrade`  
**Created**: 2025-12-07  
**Status**: Draft  
**Input**: User description: "Nuxt3 を Nuxt4 にアップグレードし、必要なライブラリを更新する"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Upgrade dev environment (Priority: P1)

Nuxt をメジャーアップグレード（v3 -> v4）し、開発者がローカルで既存のワークフロー（`dev`, `build`, `preview`, テスト）を問題なく実行できるようにする。

**Why this priority**: 開発・デプロイの互換性確保と将来のメンテナンス性向上のため。Nuxt4 の新機能やセキュリティ更新を取り込む必要がある。

**Independent Test**: `npm install` 後に `npm run dev` が起動し、主要なページ（`/`, `/session`）が表示されることを目視で確認する。

**Acceptance Scenarios**:

1. **Given** 既存のソースがある状態、 **When** 開発サーバーを起動すると、 **Then** ブラウザで主要ページが表示される。
2. **Given** CI 上で `npm run build` を実行すると、 **When** ビルドが完了すれば、 **Then** `npm run preview` で生成物を正しく配信できる。

---

### User Story 2 - Tests and Typechecks (Priority: P2)

既存のユニット / e2e テストが Nuxt4 環境で実行できること（`vitest`, `playwright` 等）。TypeScript の型チェックがパスすること。

**Why this priority**: 回帰を防ぎつつ品質を担保するため。

**Independent Test**: `npm run test`（ワークスペース）および `npm run test:e2e` が実行されること。

**Acceptance Scenarios**:

1. **Given** 依存をインストールした状態、 **When** `npm run test` を実行すると、 **Then** 既存の unit テストが失敗しない。

---

### User Story 3 - Documentation and CI adjustments (Priority: P3)

プロジェクトドキュメント、Docker 設定、CI スクリプト（存在する場合）を更新し、Nuxt4 に合わせる。

**Why this priority**: デプロイと CI の失敗を回避するため。

**Independent Test**: `docker compose up --build` がローカルで成功する（既存 Docker 設定に依存する）。

**Acceptance Scenarios**:

1. **Given** Docker 環境、 **When** コンテナをビルドすると、 **Then** Web コンテナが起動する。

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- Node / npm のバージョン要件が満たされていない環境で依存インストールが失敗する。
- 一部のサードパーティパッケージが Nuxt4 と互換性がなく、ランタイムエラーが発生する。
- `.nuxt` / `.output` の生成アーティファクトが古いまま残っていると型解決やビルドに失敗する。

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: The repository MUST use `nuxt` v4.x for the `apps/web` project.
- **FR-002**: All dev and build scripts (`dev`, `build`, `preview`, `prepare`) MUST continue to function after the upgrade.
- **FR-003**: TypeScript configuration MUST be compatible and type checking MUST pass (`tsc --noEmit`).
- **FR-004**: Existing unit and e2e tests MUST run or documented failures reported.
- **FR-005**: Docker and CI workflows MUST be updated to use Node.js versions compatible with Nuxt4 where necessary.

### Key Entities *(include if feature involves data)*

- Not applicable — this change is infrastructure/dependency-focused and does not introduce new domain data models.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Developer can run `npm run dev` and load the main pages within 30 seconds on a typical dev machine.
- **SC-002**: CI `build` completes successfully (exit code 0) within current CI time budgets.
- **SC-003**: Type checking passes (`tsc --noEmit` returns exit code 0).
- **SC-004**: At least 90% of existing unit tests pass, or failures are documented with migration tasks.
