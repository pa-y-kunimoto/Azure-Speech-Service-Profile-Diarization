# Quickstart: 話者分離・話者認識実験アプリケーション

**Date**: 2025-12-01  
**Updated**: 2025-12-03  
**Feature**: 001-speaker-diarization-experiment

## 前提条件

- Node.js 22.x LTS（VOLTA でバージョン管理）
- npm 10.x 以上
- Azure Speech Service リソース（API キーとエンドポイント）※オプション
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
# .env.example をコピー（apps/api ディレクトリ）
cp apps/api/.env.example apps/api/.env

# .env を編集して Azure の認証情報を設定（省略可能 - モックモードで動作）
```

**apps/api/.env ファイル**:

```bash
# Azure Speech Service (Optional - mock mode available without these)
SPEECH_KEY=your-azure-speech-key
SPEECH_ENDPOINT=https://your-region.api.cognitive.microsoft.com/

# Application
NODE_ENV=development
PORT=3001
```

> **Note**: Azure 認証情報がない場合でも、MockDiarizationClient を使用して開発・テストが可能です。

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
- **Nuxt フロントエンド**: http://localhost:3002
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

1. http://localhost:3002 にアクセス
2. 「プロフィールを追加」をクリック
3. 以下のいずれかで音声を登録：
   - **アップロード**: WAV/MP3 ファイルを選択
   - **録音**: マイクボタンをクリックして録音（最低5秒）
4. プロフィール名を入力して「保存」

### 3.2 話者分離セッションの開始

1. 「セッション」ページに移動
2. プロフィール一覧から使用するプロフィールを選択（チェックボックス）
3. 「セッション開始」をクリック

### 3.3 エンロールメントプロセス

セッション開始後、以下の処理が自動で行われます：

1. 選択したプロフィールの音声が Azure に送信される
2. Azure が音声から話者を検出し speakerId を割り当てる
3. 検出された speakerId がプロフィールに自動マッピングされる
4. エンロールメント発話は紫色背景で表示される

> **重要**: Azure は事前登録した声紋との照合は行いません。エンロールメント時に検出された speakerId を使用してマッピングを行います。

### 3.4 リアルタイム話者認識

1. エンロールメント完了後、「認識開始」ボタンをクリック
2. マイクに向かって話す
3. 認識結果がリアルタイムで表示される
4. 登録済みの話者はプロフィール名で、未登録は speakerId で表示

### 3.5 手動スピーカーマッピング

エンロールメントで検出されなかった話者を手動でマッピング：

1. 「検出された話者」セクションに表示されるスピーカーID（例: Guest-1）をクリック
2. ダイアログからプロフィールを選択
3. 「割り当て」をクリック

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
4. モックモードで動作させる場合は環境変数を空にする

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

### スピーカーが検出されない

**症状**: エンロールメント後もプロフィールに「未割当」と表示される

**解決策**:
1. プロフィール音声が5秒以上あることを確認
2. 音声品質を確認（ノイズが少ない環境で録音）
3. 手動マッピングで speakerId を割り当てる

### 重複したトランスクリプト

**症状**: 同じ発話が複数回表示される

**解決策**:
1. セッションを再起動
2. ブラウザをリロード

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
│   ├── web/          # Nuxt 4 フロントエンド (port 3002)
│   └── api/          # ExpressJS バックエンド (port 3001)
├── packages/
│   ├── core/         # 共通型定義
│   └── speech-client/ # Azure Speech SDK ラッパー
└── specs/            # 仕様書
```

詳細は [plan.md](./plan.md) を参照。

---

## 9. Azure の制限事項

### ConversationTranscriber の動作

Azure ConversationTranscriber は**話者分離（Diarization）のみ**を行います：

- ✅ 複数話者の音声を区別
- ✅ 各発話に speakerId を割り当て
- ❌ 事前登録した音声プロフィールとの照合
- ❌ 永続的な話者識別

### 回避策

1. **エンロールメント**: セッション開始時にプロフィール音声を送信し、検出された speakerId を自動マッピング
2. **手動マッピング**: UI から speakerId とプロフィールを手動で紐付け

### speakerId の動作

- 形式: `Guest-1`, `Guest-2`, `Guest-3`, ...
- セッションごとにリセット
- 同一セッション内では一貫性あり
