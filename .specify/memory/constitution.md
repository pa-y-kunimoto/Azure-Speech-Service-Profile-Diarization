<!--
  Sync Impact Report
  ==================
  Version change: 1.0.0 → 1.1.0
  
  Modified principles: N/A
  
  Added sections:
  - Platform (Microsoft Azure)
  - Azure サービス詳細拡張
  
  Removed sections: N/A
  
  Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (Compatible - Constitution Check section exists)
  - .specify/templates/spec-template.md ✅ (Compatible - Requirements structure aligned)
  - .specify/templates/tasks-template.md ✅ (Compatible - TDD workflow supported)
  
  Follow-up TODOs: None
-->

# Azure Speech Service Profile Diarization Constitution

## Core Principles

### I. Test-First Development (NON-NEGOTIABLE)

テスト駆動開発（TDD）を厳格に遵守する。コード実装の前に必ずテストコードを設計・実装すること。

- **Red-Green-Refactor サイクル**: テスト作成 → テスト失敗確認 → 最小限の実装 → テスト成功 → リファクタリング
- **古典派 TDD を優先**: 実際のオブジェクトと振る舞いを使用したテストを第一選択とする
- **モックは最終手段**: 外部サービス（Azure Speech Service等）との統合部分のみモックを許可
- **テストカバレッジ**: 新規コードは最低80%のカバレッジを維持すること
- **テストの独立性**: 各テストは他のテストに依存せず、単独で実行可能であること

**根拠**: 古典派TDDにより、実装の詳細ではなく振る舞いをテストし、リファクタリング耐性の高いテストスイートを構築する。

### II. Technology Stack Compliance

プロジェクト全体で以下の技術スタックを統一的に使用すること。

- **ランタイム**: Node.js LTS（VOLTA でバージョン管理）
- **言語**: TypeScript LTS（厳格モード有効）
- **フロントエンド**: Nuxt 4
- **バックエンド**: ExpressJS
- **スタイリング**: TailwindCSS
- **バージョン管理**: VOLTA（Node.js/npm バージョンのピン留め）
- **モノレポ構成**: npm workspaces を使用

**根拠**: 統一されたスタックにより、チーム全体の生産性向上とメンテナンス性の確保を実現する。

### III. Coding Standards

言語・フレームワークが推奨する標準スタイルに準拠する。

- **フォーマッター**: Biome.js を使用（Prettier/ESLint の代替として統一）
- **TypeScript**: strict モード有効、`any` 型の使用禁止（やむを得ない場合は理由をコメント）
- **命名規則**: camelCase（変数・関数）、PascalCase（型・クラス・インターフェース）
- **ファイル構造**: 機能ごとにモジュール化、1ファイル1責務
- **コメント**: 複雑なビジネスロジックには JSDoc 形式でドキュメントを記載

**根拠**: 一貫したコードスタイルにより、コードレビューの効率化と可読性の向上を図る。

### IV. Secret Management

シークレットおよび機密情報は安全に管理すること。

- **環境変数**: すべてのシークレット（APIキー、接続文字列等）は環境変数で管理
- **`.env` ファイル**: `.gitignore` に必ず登録、リポジトリにコミット禁止
- **`.env.example`**: 必要な環境変数のテンプレートをリポジトリに含める（値は空欄）
- **Azure Key Vault**: 本番環境では Azure Key Vault からのシークレット取得を推奨
- **ハードコーディング禁止**: ソースコード内にシークレットを直接記載しないこと

**根拠**: セキュリティインシデントを防止し、シークレットのローテーションを容易にする。

### V. Monorepo & Library-First

モノレポ構成を活用し、機能をライブラリとして分離する。

- **パッケージ構成**: `packages/` ディレクトリ配下に独立したパッケージを配置
- **依存関係**: パッケージ間の依存は明示的に宣言、循環依存禁止
- **独立テスト**: 各パッケージは独自のテストスイートを持つこと
- **CLI エクスポート**: 主要機能は CLI インターフェースを提供すること
- **ドキュメント**: 各パッケージに README.md を必須とする

**根拠**: 関心の分離により、独立した開発・テスト・デプロイが可能となる。

## Platform

**クラウドプラットフォーム**: Microsoft Azure

すべてのクラウドリソースおよびサービスは Microsoft Azure 上にデプロイ・運用する。

### Azure 利用原則

- **リージョン選択**: 日本リージョン（Japan East / Japan West）を優先
- **リソースグループ**: 環境ごとに分離（dev / staging / prod）
- **命名規則**: `{project}-{env}-{resource-type}` 形式を遵守
- **インフラストラクチャ**: Infrastructure as Code（Bicep / Terraform）を推奨
- **監視**: Azure Monitor / Application Insights を活用

## Technology Stack

### 必須ツール

| カテゴリ | ツール | バージョン |
|----------|--------|------------|
| ランタイム | Node.js | LTS (VOLTA管理) |
| 言語 | TypeScript | LTS |
| フロントエンド | Nuxt | 4.x |
| バックエンド | ExpressJS | 4.x |
| スタイリング | TailwindCSS | 3.x |
| フォーマッター | Biome.js | Latest |
| バージョン管理 | VOLTA | Latest |
| パッケージ管理 | npm workspaces | - |

### Azure サービス

| サービス | 用途 |
|----------|------|
| Azure Speech Service | 話者分離（Speaker Diarization）、音声認識 |
| Azure Key Vault | シークレット管理（本番環境） |
| Azure App Service / Container Apps | アプリケーションホスティング |
| Azure Static Web Apps | フロントエンドホスティング（Nuxt SSG時） |
| Azure Blob Storage | 音声ファイルストレージ |
| Azure Monitor | ログ・メトリクス監視 |
| Application Insights | APM・分散トレーシング |

## Development Workflow

### コード変更フロー

1. **テスト設計**: 変更に必要なテストケースを設計
2. **テスト実装**: テストコードを実装し、失敗を確認（Red）
3. **最小実装**: テストを通過する最小限のコードを実装（Green）
4. **リファクタリング**: コード品質を改善（Refactor）
5. **Biome チェック**: `npm run lint` でコード品質を検証
6. **コミット**: 論理的な単位でコミット

**Version**: 1.1.0 | **Ratified**: 2025-12-01 | **Last Amended**: 2025-12-01

- [ ] すべてのテストが通過すること
- [ ] Biome.js のエラー/警告がゼロであること
- [ ] 新規コードにテストが含まれていること
- [ ] シークレットがコミットに含まれていないこと
- [ ] TypeScript の型エラーがないこと

## Governance

- この Constitution はプロジェクトの他のすべてのプラクティスに優先する
- Constitution の修正には、ドキュメントの更新と影響範囲の分析が必要
- すべての PR/レビューは Constitution への準拠を確認すること
- 複雑さの追加には正当な理由と、却下された代替案の記載が必要

### バージョニングポリシー

- **MAJOR**: 原則の削除または再定義（後方互換性なし）
- **MINOR**: 新しい原則/セクションの追加または実質的な拡張
- **PATCH**: 明確化、表現の修正、タイポ修正

**Version**: 1.0.0 | **Ratified**: 2025-12-01 | **Last Amended**: 2025-12-01
