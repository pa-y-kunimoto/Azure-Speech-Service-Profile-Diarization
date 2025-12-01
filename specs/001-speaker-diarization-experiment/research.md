# Research: 話者分離・話者認識実験アプリケーション

**Date**: 2025-12-01  
**Feature**: 001-speaker-diarization-experiment  
**Status**: Complete

## 概要

Azure Speech Service の話者分離（Diarization）機能を使用して、リアルタイム話者認識を実現するための技術調査結果。

---

## 1. Azure Speech Service 話者分離機能

### Decision: ConversationTranscriber API を使用

**選択した API**: `ConversationTranscriber`（Conversation Transcription）

**Rationale**:
- 話者分離（Diarization）と音声認識を同時に実行可能
- リアルタイムストリーミングとファイル入力の両方に対応
- `speakerId` を含む認識結果を取得可能
- JavaScript/TypeScript SDK でフルサポート

**Alternatives Considered**:

| 選択肢 | 却下理由 |
|--------|----------|
| SpeechRecognizer | 話者分離機能なし（音声認識のみ） |
| Fast Transcription API | REST API のみ、リアルタイム非対応 |
| Speaker Verification API | 事前登録した声紋との照合用、目的が異なる |

### SDK 構成

```typescript
import {
  SpeechConfig,
  AudioConfig,
  ConversationTranscriber,
  AudioInputStream
} from "microsoft-cognitiveservices-speech-sdk";
```

### 使用パターン

```typescript
// ファイルからの話者分離
const speechConfig = SpeechConfig.fromEndpoint(
  new URL(process.env.SPEECH_ENDPOINT),
  process.env.SPEECH_KEY
);
const audioConfig = AudioConfig.fromWavFileInput(audioBuffer);
const transcriber = new ConversationTranscriber(speechConfig, audioConfig);

transcriber.transcribed = (s, e) => {
  console.log(`Text: ${e.result.text}, Speaker: ${e.result.speakerId}`);
};

transcriber.startTranscribingAsync();
```

---

## 2. リアルタイムマイク入力

### Decision: PushStream を使用

**選択**: `AudioInputStream.createPushStream()` + Web Audio API

**Rationale**:
- ブラウザの MediaRecorder/Web Audio API から取得した音声データを直接 Azure に送信可能
- バッファリングとチャンク送信を制御可能
- リアルタイム遅延を最小化

**実装パターン**:

```typescript
// ブラウザ側
const pushStream = AudioInputStream.createPushStream();
const audioConfig = AudioConfig.fromStreamInput(pushStream);

// マイク入力を PushStream に送信
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      // 音声データを ArrayBuffer に変換して送信
      pushStream.write(new Uint8Array(arrayBuffer));
    };
  });
```

**Alternatives Considered**:

| 選択肢 | 却下理由 |
|--------|----------|
| AudioConfig.fromDefaultMicrophoneInput() | Node.js 環境のみ、ブラウザ非対応 |
| WebSocket 直接接続 | SDK の抽象化を活用できない |

---

## 3. ブラウザ音声録音

### Decision: MediaRecorder API + WAV エンコード

**選択**: `MediaRecorder` API でオーディオキャプチャ、WAV 形式で保存

**Rationale**:
- ブラウザ標準 API で追加ライブラリ不要
- Azure Speech Service は WAV 形式を推奨
- PCM 16-bit, 16kHz がダイアライゼーションに最適

**音声フォーマット要件**:

| パラメータ | 推奨値 |
|-----------|--------|
| サンプルレート | 16kHz（最低 8kHz） |
| チャンネル | モノラル（1ch） |
| ビット深度 | 16-bit PCM |
| 形式 | WAV / PCM |

**Alternatives Considered**:

| 選択肢 | 却下理由 |
|--------|----------|
| MP3 | 圧縮による品質劣化、デコード必要 |
| WebM/Opus | Azure Speech Service の推奨外 |

---

## 4. セッションストレージ設計

### Decision: SessionStorage + Base64 エンコード

**選択**: ブラウザの `sessionStorage` に音声データを Base64 エンコードで保存

**Rationale**:
- 実験用途のため永続化不要
- ブラウザタブ終了で自動クリア
- 追加インフラ不要

**制約**:

| 項目 | 制限 |
|------|------|
| 容量上限 | 5-10MB（ブラウザ依存） |
| 音声ファイルサイズ | 約 30 秒 @ 16kHz = 約 1MB |
| 保存可能プロフィール数 | 約 5-10 件 |

**データ構造**:

```typescript
interface StoredVoiceProfile {
  id: string;
  name: string;
  audioBase64: string;  // Base64 エンコードされた WAV
  createdAt: string;    // ISO 8601
  durationMs: number;
}
```

**Alternatives Considered**:

| 選択肢 | 却下理由 |
|--------|----------|
| IndexedDB | 実験用途には過剰、セッション終了で消えない |
| localStorage | sessionStorage と同等だが永続化される |
| Azure Blob Storage | インフラ追加が必要、実験目的には過剰 |

---

## 5. フロントエンド・バックエンド分離

### Decision: バックエンドプロキシ経由で Azure 接続

**選択**: ExpressJS バックエンドが Azure Speech Service に接続、フロントエンドは API 経由

**Rationale**:
- Azure API キーをクライアントに公開しない
- CORS 問題を回避
- 接続状態の集中管理

**アーキテクチャ**:

```
[ブラウザ]
    |
    | WebSocket / REST API
    v
[ExpressJS API]  ← Azure API Key (環境変数)
    |
    | microsoft-cognitiveservices-speech-sdk
    v
[Azure Speech Service]
```

**Alternatives Considered**:

| 選択肢 | 却下理由 |
|--------|----------|
| フロントエンド直接接続 | API キー露出リスク |
| Azure Functions | 追加サービス導入、モノレポ複雑化 |

---

## 6. テストフレームワーク

### Decision: Vitest + Playwright

**ユニット/統合テスト**: Vitest

**Rationale**:
- Nuxt 4 / TypeScript との親和性が高い
- Jest 互換 API で学習コスト低
- 高速な実行

**E2E テスト**: Playwright

**Rationale**:
- マルチブラウザ対応
- マイクアクセスのモックサポート
- Nuxt との統合が容易

**Azure SDK モック戦略**:

```typescript
// 古典派 TDD に従い、モックは Azure SDK 接続部分のみ
vi.mock("microsoft-cognitiveservices-speech-sdk", () => ({
  SpeechConfig: {
    fromEndpoint: vi.fn().mockReturnValue({})
  },
  ConversationTranscriber: vi.fn().mockImplementation(() => ({
    startTranscribingAsync: vi.fn(),
    stopTranscribingAsync: vi.fn(),
    transcribed: null
  }))
}));
```

---

## 7. SpeakerId マッピング戦略

### Decision: セッション内メモリマップ

**選択**: フロントエンドの Vue リアクティブ状態でマッピング保持

**Rationale**:
- セッション中のみ有効で十分
- Azure が割り当てる speakerId は `Guest-1`, `Guest-2` 形式
- プロフィール登録順序と speakerId を紐付け

**実装**:

```typescript
interface SpeakerMapping {
  speakerId: string;      // Azure が返す ID (e.g., "Guest-1")
  profileName: string;    // ユーザーが設定した名前
  profileId: string;      // 内部 ID
}

// セッション状態
const speakerMappings = ref<Map<string, SpeakerMapping>>(new Map());
```

**Azure speakerId の動作**:
- `Guest-1`, `Guest-2`, ... の形式で自動割り当て
- 同一セッション内で一貫性あり
- セッション終了でリセット

---

## 8. エラーハンドリング戦略

### Decision: 階層化エラー処理

**レイヤー別エラー処理**:

| レイヤー | 処理方法 |
|----------|----------|
| Azure SDK | try-catch + リトライ（最大3回） |
| API 層 | HTTP ステータスコード + エラーメッセージ |
| フロントエンド | Toast 通知 + 状態リセット |

**接続エラー時のリトライ**:

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw new Error("Max retries exceeded");
}
```

---

## 9. 環境変数設計

### Decision: 標準的な環境変数命名

**必要な環境変数**:

```bash
# Azure Speech Service
SPEECH_KEY=your-speech-key
SPEECH_ENDPOINT=https://your-region.api.cognitive.microsoft.com/

# アプリケーション設定
NODE_ENV=development
PORT=3001
```

**.env.example**:

```bash
# Azure Speech Service (Required)
SPEECH_KEY=
SPEECH_ENDPOINT=

# Application
NODE_ENV=development
PORT=3001
```

---

## 10. パフォーマンス考慮事項

### リアルタイム認識の遅延目標

| 処理 | 目標時間 |
|------|----------|
| マイク → API | < 100ms |
| API → Azure | < 500ms |
| Azure 認識 | < 2000ms |
| 結果表示 | < 100ms |
| **合計** | **< 3秒** |

### 最適化手法

1. **音声チャンク送信**: 100ms 間隔でバッファリング
2. **WebSocket 利用**: REST より低遅延
3. **プリコネクション**: セッション開始前に Azure 接続確立

---

## まとめ

| カテゴリ | 決定事項 |
|----------|----------|
| 話者分離 API | ConversationTranscriber |
| リアルタイム入力 | PushStream + Web Audio API |
| 音声形式 | WAV (16kHz, 16-bit, Mono) |
| ストレージ | sessionStorage + Base64 |
| アーキテクチャ | バックエンドプロキシ経由 |
| テスト | Vitest + Playwright |
| モック戦略 | Azure SDK 接続部分のみ |

すべての NEEDS CLARIFICATION が解決され、Phase 1 に進行可能。
