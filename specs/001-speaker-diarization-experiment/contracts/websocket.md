# WebSocket メッセージスキーマ

**Updated**: 2025-12-03  
**Endpoint**: `ws://localhost:3001/ws`

## 概要

リアルタイム音声認識用の双方向 WebSocket 通信プロトコル。エンロールメントと手動マッピングをサポート。

---

## クライアント → サーバー メッセージ

### 1. audio - 音声データ送信

リアルタイムマイク入力の音声チャンクを送信。

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

セッションの制御を行う。

```json
{
  "type": "control",
  "action": "start" | "stop" | "pause" | "resume" | "mapSpeaker",
  "speakerId": "Guest-1",        // mapSpeaker時のみ
  "profileId": "uuid",            // mapSpeaker時のみ
  "displayName": "田中さん"       // mapSpeaker時のみ
}
```

| action | 説明 |
|--------|------|
| start | 認識開始 |
| stop | 認識終了 |
| pause | 一時停止 |
| resume | 再開 |
| mapSpeaker | 手動スピーカーマッピング |

**mapSpeaker の例**:
```json
{
  "type": "control",
  "action": "mapSpeaker",
  "speakerId": "Guest-1",
  "profileId": "550e8400-e29b-41d4-a716-446655440000",
  "displayName": "田中さん"
}
```

### 3. registerProfile - プロフィール登録

エンロールメント用のプロフィールを登録。

```json
{
  "type": "registerProfile",
  "profile": {
    "profileId": "uuid",
    "profileName": "田中さん",
    "audioBase64": "<Base64 encoded WAV audio>"
  }
}
```

| フィールド | 型 | 説明 |
|-----------|------|------|
| profileId | string | プロフィールの UUID |
| profileName | string | 表示名 |
| audioBase64 | string | Base64 エンコードされた WAV 音声 |

### 4. startEnrollment - エンロールメント開始

登録済みプロフィールのエンロールメントを開始。

```json
{
  "type": "startEnrollment"
}
```

---

## サーバー → クライアント メッセージ

### 1. transcription - 認識結果

音声認識の結果（中間または最終）。

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
    "isFinal": true,
    "isEnrollment": false,
    "enrollmentProfileName": null
  }
}
```

| フィールド | 型 | 説明 |
|-----------|------|------|
| id | string | 発話 UUID |
| text | string | 認識テキスト |
| speakerId | string | Azure speakerId |
| speakerName | string | 表示名（マッピング済みならプロフィール名） |
| timestamp | string | ISO 8601 タイムスタンプ |
| offsetMs | number | セッション開始からのオフセット (ms) |
| confidence | number | 認識信頼度 (0.0-1.0) |
| isFinal | boolean | 最終結果かどうか |
| isEnrollment | boolean | エンロールメント音声からの発話かどうか |
| enrollmentProfileName | string \| null | エンロールメント時のプロフィール名 |

### 2. speakerDetected - 話者検出

新しい話者が検出された。

```json
{
  "type": "speakerDetected",
  "speakerId": "Guest-1"
}
```

### 3. speakerMapped - 話者マッピング完了

話者がプロフィールにマッピングされた（エンロールメントまたは手動）。

```json
{
  "type": "speakerMapped",
  "mapping": {
    "speakerId": "Guest-1",
    "profileId": "uuid",
    "profileName": "田中さん",
    "isRegistered": true,
    "mappingSource": "enrollment"
  }
}
```

| フィールド | 型 | 説明 |
|-----------|------|------|
| mappingSource | string | `"enrollment"` または `"manual"` |

### 4. enrollmentComplete - エンロールメント完了

すべてのプロフィールのエンロールメントが完了。

```json
{
  "type": "enrollmentComplete",
  "enrolled": 3,
  "mapped": 2
}
```

| フィールド | 型 | 説明 |
|-----------|------|------|
| enrolled | number | 登録されたプロフィール数 |
| mapped | number | マッピングされたスピーカー数 |

### 5. status - 状態変更

セッション状態が変更された。

```json
{
  "type": "status",
  "status": "active",
  "message": "リアルタイム認識を開始しました"
}
```

| status | 説明 |
|--------|------|
| idle | 待機中 |
| connecting | 接続中 |
| connected | 接続完了 |
| registering | エンロールメント中 |
| active | 認識中 |
| paused | 一時停止 |
| ended | 終了 |
| error | エラー発生 |

### 6. error - エラー

エラーが発生した。

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
| code | string | エラーコード |
| message | string | エラーメッセージ |
| recoverable | boolean | リトライ可能かどうか |

---

## 接続シーケンス（エンロールメントあり）

```
Client                                    Server
   |                                         |
   |  WebSocket connect                      |
   |---------------------------------------->|
   |                                         |
   |  { type: "status", status: "connected" }|
   |<----------------------------------------|
   |                                         |
   |  === Profile Registration Phase ===     |
   |                                         |
   |  { type: "registerProfile", ... }       |
   |---------------------------------------->|
   |  (repeat for each profile)              |
   |                                         |
   |  { type: "startEnrollment" }            |
   |---------------------------------------->|
   |                                         |
   |  { type: "status", status: "registering" }
   |<----------------------------------------|
   |                                         |
   |  { type: "transcription", isEnrollment: true }
   |<----------------------------------------|
   |  (enrollment transcripts)               |
   |                                         |
   |  { type: "speakerMapped", ... }         |
   |<----------------------------------------|
   |  (for each detected speaker)            |
   |                                         |
   |  { type: "enrollmentComplete", ... }    |
   |<----------------------------------------|
   |                                         |
   |  { type: "status", status: "active" }   |
   |<----------------------------------------|
   |                                         |
   |  === Real-time Recognition Phase ===    |
   |                                         |
   |  { type: "audio", data: "..." }         |
   |---------------------------------------->|
   |                                         |
   |  { type: "transcription", ... }         |
   |<----------------------------------------|
   |                                         |
   |  { type: "speakerDetected", ... }       |
   |<----------------------------------------|
   |  (new speaker detected)                 |
   |                                         |
   |  === Manual Mapping (optional) ===      |
   |                                         |
   |  { type: "control", action: "mapSpeaker", ... }
   |---------------------------------------->|
   |                                         |
   |  { type: "speakerMapped", mappingSource: "manual" }
   |<----------------------------------------|
   |                                         |
   |  === Session End ===                    |
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
| ENROLLMENT_FAILED | エンロールメント失敗 | true |
| INVALID_AUDIO_FORMAT | 音声フォーマットが不正 | false |

---

## 音声フォーマット要件

| パラメータ | 推奨値 |
|-----------|--------|
| サンプルレート | 16kHz |
| チャンネル | モノラル (1ch) |
| ビット深度 | 16-bit PCM |
| 形式 | WAV |
| チャンクサイズ | 3200 bytes (100ms) |

---

## 実装上の注意

### エンロールメントの動作

1. クライアントは `registerProfile` で各プロフィールを登録
2. `startEnrollment` でエンロールメント処理を開始
3. サーバーは各プロフィールの音声を順番に Azure に送信
4. 音声送信中に検出された speakerId を収集
5. 検出された speakerId をプロフィールにマッピング
6. `enrollmentComplete` でエンロールメント完了を通知

### 手動マッピングの動作

1. クライアントは `speakerDetected` で新しいスピーカーを検知
2. UI で speakerId をクリックしてプロフィールを選択
3. `control` メッセージ (`action: "mapSpeaker"`) を送信
4. サーバーは内部マッピングを更新
5. `speakerMapped` で完了を通知

### トランスクリプトの区別

- `isEnrollment: true`: エンロールメント音声からの発話（紫色表示）
- `isEnrollment: false`: リアルタイムマイク入力からの発話（通常表示）
