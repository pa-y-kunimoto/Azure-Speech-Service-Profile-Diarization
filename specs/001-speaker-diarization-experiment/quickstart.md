# Quickstart: 話者分離・話者認識実験アプリケーション

**Date**: 2025-12-01  
**Feature**: 001-speaker-diarization-experiment

## 前提条件

- Node.js 22.x LTS（VOLTA でバージョン管理）
- npm 10.x 以上
- Azure Speech Service リソース（API キーとエンドポイント）
- モダンブラウザ（Chrome/Edge/Safari/Firefox 最新版）

---

## 1. 環境セットアップ

### 1.1 リポジトリのクローンと依存関係のインストール

```bash
# リポジトリをクローン
git clone https://github.com/your-org/Azure-Speech-Service-Profile-Diarization.git
cd Azure-Speech-Service-Profile-Diarization

# VOLTA で Node.js バージョンを固定（初回のみ）
volta install node@22
volta install npm@10

# 依存関係をインストール
npm install
```

### 1.2 環境変数の設定

```bash
# .env.example をコピー
cp .env.example .env

# .env を編集して Azure の認証情報を設定
```

**.env ファイル**:

```bash
# Azure Speech Service (Required)
SPEECH_KEY=your-azure-speech-key
SPEECH_ENDPOINT=https://your-region.api.cognitive.microsoft.com/

# Application
NODE_ENV=development
PORT=3001
```

---

## 2. 開発サーバーの起動

### 2.1 全サービスを起動

```bash
# ルートから全パッケージをビルド
npm run build

# 開発モードで起動
npm run dev
```

これにより以下が起動します：
- **Nuxt フロントエンド**: http://localhost:3000
- **Express API**: http://localhost:3001

### 2.2 個別に起動

```bash
# バックエンド API のみ
npm run dev --workspace=apps/api

# フロントエンドのみ
npm run dev --workspace=apps/web
```

---

## 3. 基本的な使い方

### 3.1 音声プロフィールの作成

1. http://localhost:3000 にアクセス
2. 「プロフィールを追加」をクリック
3. 以下のいずれかで音声を登録：
   - **アップロード**: WAV/MP3 ファイルを選択
   - **録音**: マイクボタンをクリックして録音（最低5秒）
4. プロフィール名を入力して「保存」

### 3.2 話者分離セッションの開始

1. プロフィール一覧から使用するプロフィールを選択（チェックボックス）
2. 「セッション開始」をクリック
3. 選択したプロフィールが Azure に登録され、speakerId が表示される
4. 「認識開始」で リアルタイム話者認識を開始

### 3.3 リアルタイム話者認識

1. マイクに向かって話す
2. 認識結果がリアルタイムで表示される
3. 登録済みの話者は名前で、未登録は「Unknown Speaker」と表示

---

## 4. テストの実行

### 4.1 全テストを実行

```bash
npm test
```

### 4.2 パッケージごとにテスト

```bash
# core パッケージ
npm test --workspace=packages/core

# speech-client パッケージ
npm test --workspace=packages/speech-client

# API
npm test --workspace=apps/api

# Web（ユニットテスト）
npm test --workspace=apps/web

# E2E テスト
npm run test:e2e --workspace=apps/web
```

### 4.3 テストカバレッジ

```bash
npm run test:coverage
```

---

## 5. ビルドとプロダクション

### 5.1 プロダクションビルド

```bash
npm run build
```

### 5.2 プロダクションモードで起動

```bash
NODE_ENV=production npm start
```

---

## 6. トラブルシューティング

### Azure 接続エラー

```
Error: Azure Speech Service への接続に失敗しました
```

**解決策**:
1. `.env` の `SPEECH_KEY` と `SPEECH_ENDPOINT` を確認
2. Azure ポータルで Speech リソースが有効か確認
3. ネットワーク接続を確認

### マイクアクセスエラー

```
Error: マイクへのアクセスが拒否されました
```

**解決策**:
1. ブラウザの設定でマイクアクセスを許可
2. HTTPS または localhost で実行していることを確認

### セッションストレージ容量超過

```
Warning: ストレージ容量が不足しています
```

**解決策**:
1. 不要なプロフィールを削除
2. 音声ファイルのサイズを小さくする（30秒以内推奨）

---

## 7. 開発コマンド一覧

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm test` | テスト実行 |
| `npm run test:coverage` | カバレッジ付きテスト |
| `npm run lint` | Biome.js でリント |
| `npm run lint:fix` | リント自動修正 |
| `npm run clean` | ビルド成果物を削除 |

---

## 8. プロジェクト構造

```
/
├── apps/
│   ├── web/          # Nuxt 4 フロントエンド
│   └── api/          # ExpressJS バックエンド
├── packages/
│   ├── core/         # 共通型定義
│   └── speech-client/ # Azure Speech SDK ラッパー
└── specs/            # 仕様書
```

詳細は [plan.md](./plan.md) を参照。
