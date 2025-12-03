# Speaker Diarization API

Azure Speech Service を使用した話者分離・話者認識実験のバックエンドAPI。

## 概要

このパッケージは、フロントエンドとAzure Speech Service間のプロキシとして機能し、以下の機能を提供します：

- セッション管理（作成、取得、終了）
- 音声プロフィール登録
- リアルタイム音声認識（WebSocket）

## エンドポイント

### REST API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | ヘルスチェック |
| POST | `/api/session` | セッション作成 |
| GET | `/api/session/:id` | セッション取得 |
| DELETE | `/api/session/:id` | セッション終了 |
| POST | `/api/session/:id/register-profile` | プロフィール登録 |

### WebSocket

| Path | Description |
|------|-------------|
| `/ws/session/:id` | リアルタイム音声認識 |

## 開発

### 起動

```bash
# 開発モード
npm run dev --workspace=apps/api

# 本番モード
npm run build --workspace=apps/api
npm run start --workspace=apps/api
```

### テスト

```bash
# ユニットテスト
npm test --workspace=apps/api

# 統合テスト
npm run test:integration --workspace=apps/api
```

## 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `SPEECH_KEY` | Azure Speech Service APIキー | ✅ |
| `SPEECH_ENDPOINT` | Azure Speech Service エンドポイント | ✅ |
| `PORT` | サーバーポート（デフォルト: 3001） | - |
| `NODE_ENV` | 環境（development/production） | - |

## ディレクトリ構成

```
src/
├── index.ts           # エントリーポイント
├── middleware/
│   └── errorHandler.ts
├── routes/
│   ├── health.ts
│   ├── session.ts
│   └── speech.ts
├── services/
│   ├── speechService.ts
│   ├── realtimeService.ts
│   └── mockSpeechService.ts
└── ws/
    ├── index.ts
    └── handler.ts
```

## API仕様

詳細なAPI仕様は `specs/001-speaker-diarization-experiment/contracts/api.yaml` を参照してください。
