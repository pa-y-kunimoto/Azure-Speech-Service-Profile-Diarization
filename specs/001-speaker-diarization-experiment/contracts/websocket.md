# WebSocket メッセージスキーマ

**Endpoint**: `ws://localhost:3001/ws/session/{sessionId}`

## 概要

リアルタイム音声認識用の双方向 WebSocket 通信プロトコル。

---

## クライアント → サーバー メッセージ

### 1. audio - 音声データ送信

```json
{
  "type": "audio",
  "data": "<Base64 encoded audio chunk>",
  "timestamp": "2025-12-01T10:30:00.000Z"
}
```

| フィールド | 型 | 説明 |
|-----------|------|------|
| type | string | `"audio"` 固定 |
| data | string | Base64 エンコードされた音声チャンク（100ms 分） |
| timestamp | string | ISO 8601 タイムスタンプ |

### 2. control - 制御コマンド

```json
{
  "type": "control",
  "action": "start" | "stop" | "pause" | "resume"
}
```

| action | 説明 |
|--------|------|
| start | 認識開始 |
| stop | 認識終了 |
| pause | 一時停止 |
| resume | 再開 |

---

## サーバー → クライアント メッセージ

### 1. transcription - 認識結果

```json
{
  "type": "transcription",
  "utterance": {
    "id": "uuid",
    "text": "こんにちは",
    "speakerId": "Guest-1",
    "speakerName": "田中さん",
    "timestamp": "2025-12-01T10:30:00.000Z",
    "offsetMs": 1500,
    "confidence": 0.95,
    "isFinal": true
  }
}
```

### 2. speaker_registered - 話者登録完了

```json
{
  "type": "speaker_registered",
  "mapping": {
    "speakerId": "Guest-1",
    "profileId": "uuid",
    "profileName": "田中さん",
    "isRegistered": true
  }
}
```

### 3. status - 状態変更

```json
{
  "type": "status",
  "status": "active",
  "message": "リアルタイム認識を開始しました"
}
```

### 4. error - エラー

```json
{
  "type": "error",
  "code": "RECOGNITION_FAILED",
  "message": "音声認識に失敗しました",
  "recoverable": true
}
```

| フィールド | 型 | 説明 |
|-----------|------|------|
| recoverable | boolean | true の場合、リトライ可能 |

---

## 接続シーケンス

```
Client                                    Server
   |                                         |
   |  WebSocket connect                      |
   |---------------------------------------->|
   |                                         |
   |  { type: "status", status: "connected" }|
   |<----------------------------------------|
   |                                         |
   |  { type: "control", action: "start" }   |
   |---------------------------------------->|
   |                                         |
   |  { type: "status", status: "active" }   |
   |<----------------------------------------|
   |                                         |
   |  { type: "audio", data: "..." }         |
   |---------------------------------------->|
   |                                         |
   |  { type: "transcription", ... }         |
   |<----------------------------------------|
   |                                         |
   |  { type: "control", action: "stop" }    |
   |---------------------------------------->|
   |                                         |
   |  { type: "status", status: "ended" }    |
   |<----------------------------------------|
   |                                         |
   |  WebSocket close                        |
   |<--------------------------------------->|
```

---

## エラーコード一覧

| コード | 説明 | recoverable |
|--------|------|-------------|
| INVALID_MESSAGE | メッセージ形式が不正 | true |
| SESSION_NOT_FOUND | セッションが存在しない | false |
| SESSION_ENDED | セッションが終了済み | false |
| AZURE_ERROR | Azure Speech Service エラー | true |
| RECOGNITION_FAILED | 認識失敗 | true |
| CONNECTION_TIMEOUT | 接続タイムアウト | true |
