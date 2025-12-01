# Data Model: 話者分離・話者認識実験アプリケーション

**Date**: 2025-12-01  
**Feature**: 001-speaker-diarization-experiment  
**Status**: Complete

## 概要

音声プロフィール管理、話者分離セッション、発話履歴に関するエンティティ定義。

---

## エンティティ一覧

```
┌─────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  VoiceProfile   │────>│  SpeakerMapping     │<────│  Utterance       │
└─────────────────┘     └─────────────────────┘     └──────────────────┘
        │                        │                          │
        │                        │                          │
        v                        v                          v
┌─────────────────────────────────────────────────────────────────────┐
│                     DiarizationSession                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. VoiceProfile（音声プロフィール）

話者を識別するための音声サンプル。ユーザーがアップロードまたは録音した音声データ。

### 属性

| 属性名 | 型 | 必須 | 説明 |
|--------|------|------|------|
| id | string | ✅ | 一意識別子（UUID v4） |
| name | string | ✅ | プロフィール名（ユーザー入力） |
| audioData | Blob | ✅ | 音声データ（WAV 形式） |
| audioBase64 | string | - | Base64 エンコード済み音声（保存用） |
| durationMs | number | ✅ | 音声の長さ（ミリ秒） |
| format | AudioFormat | ✅ | 音声フォーマット情報 |
| source | "upload" \| "recording" | ✅ | 作成方法 |
| createdAt | Date | ✅ | 作成日時 |

### AudioFormat（埋め込み型）

| 属性名 | 型 | 説明 |
|--------|------|------|
| sampleRate | number | サンプルレート（Hz） |
| channels | number | チャンネル数 |
| bitsPerSample | number | ビット深度 |
| codec | string | コーデック名 |

### バリデーションルール

- `name`: 1〜50文字、空白のみ不可
- `durationMs`: 最低5000ms（5秒）以上
- `format.sampleRate`: 8000〜48000Hz
- `audioData`: 最大5MB

### 状態遷移

```
[作成中] → [保存済み] → [セッション登録済み]
                ↓
            [削除済み]
```

---

## 2. DiarizationSession（話者分離セッション）

Azure Speech Service との接続セッション。複数の話者マッピングと発話を管理。

### 属性

| 属性名 | 型 | 必須 | 説明 |
|--------|------|------|------|
| id | string | ✅ | セッション識別子（UUID v4） |
| status | SessionStatus | ✅ | セッション状態 |
| startedAt | Date | - | 開始日時 |
| endedAt | Date | - | 終了日時 |
| selectedProfileIds | string[] | ✅ | 選択された VoiceProfile の ID リスト |
| speakerMappings | SpeakerMapping[] | - | 話者マッピングリスト |
| utterances | Utterance[] | - | 発話リスト |
| error | SessionError \| null | - | エラー情報 |

### SessionStatus（列挙型）

| 値 | 説明 |
|------|------|
| idle | 初期状態 |
| connecting | Azure に接続中 |
| registering | プロフィール登録中 |
| active | リアルタイム認識中 |
| paused | 一時停止中 |
| ended | 終了済み |
| error | エラー発生 |

### SessionError（埋め込み型）

| 属性名 | 型 | 説明 |
|--------|------|------|
| code | string | エラーコード |
| message | string | エラーメッセージ |
| timestamp | Date | 発生日時 |

### 状態遷移

```
[idle] → [connecting] → [registering] → [active] → [ended]
    ↓         ↓              ↓            ↓
  [error]   [error]        [error]      [paused]
                                          ↓
                                       [active]
```

---

## 3. SpeakerMapping（話者マッピング）

音声プロフィールと Azure が割り当てた speakerId の対応関係。

### 属性

| 属性名 | 型 | 必須 | 説明 |
|--------|------|------|------|
| speakerId | string | ✅ | Azure が割り当てた ID（例: "Guest-1"） |
| profileId | string | - | 対応する VoiceProfile の ID |
| profileName | string | ✅ | 表示名（プロフィール名または "Unknown Speaker"） |
| isRegistered | boolean | ✅ | プロフィールに紐づいているか |
| registeredAt | Date | - | 登録日時 |

### バリデーションルール

- `speakerId`: Azure から返される形式（"Guest-N" または "Speaker-N"）
- `profileName`: 未登録話者は "Unknown Speaker (speakerId)" 形式

---

## 4. Utterance（発話）

認識された発話。テキスト、話者、タイムスタンプを含む。

### 属性

| 属性名 | 型 | 必須 | 説明 |
|--------|------|------|------|
| id | string | ✅ | 発話識別子（UUID v4） |
| text | string | ✅ | 認識されたテキスト |
| speakerId | string | ✅ | Azure の speakerId |
| speakerName | string | ✅ | 表示用の話者名 |
| timestamp | Date | ✅ | 発話開始時刻 |
| offsetMs | number | ✅ | セッション開始からのオフセット（ミリ秒） |
| durationMs | number | - | 発話の長さ（ミリ秒） |
| confidence | number | - | 認識信頼度（0.0〜1.0） |
| isFinal | boolean | ✅ | 最終結果かどうか |

### バリデーションルール

- `text`: 空文字でない
- `confidence`: 0.0〜1.0 の範囲
- `offsetMs`: 0 以上

---

## TypeScript 型定義

```typescript
// packages/core/src/types/voiceProfile.ts
export type AudioSource = "upload" | "recording";

export interface AudioFormat {
  sampleRate: number;    // Hz
  channels: number;
  bitsPerSample: number;
  codec: string;
}

export interface VoiceProfile {
  id: string;
  name: string;
  audioData: Blob;
  audioBase64?: string;
  durationMs: number;
  format: AudioFormat;
  source: AudioSource;
  createdAt: Date;
}

export interface StoredVoiceProfile {
  id: string;
  name: string;
  audioBase64: string;
  durationMs: number;
  format: AudioFormat;
  source: AudioSource;
  createdAt: string;  // ISO 8601
}
```

```typescript
// packages/core/src/types/diarizationSession.ts
export type SessionStatus =
  | "idle"
  | "connecting"
  | "registering"
  | "active"
  | "paused"
  | "ended"
  | "error";

export interface SessionError {
  code: string;
  message: string;
  timestamp: Date;
}

export interface DiarizationSession {
  id: string;
  status: SessionStatus;
  startedAt?: Date;
  endedAt?: Date;
  selectedProfileIds: string[];
  speakerMappings: SpeakerMapping[];
  utterances: Utterance[];
  error: SessionError | null;
}
```

```typescript
// packages/core/src/types/speakerMapping.ts
export interface SpeakerMapping {
  speakerId: string;
  profileId?: string;
  profileName: string;
  isRegistered: boolean;
  registeredAt?: Date;
}
```

```typescript
// packages/core/src/types/utterance.ts
export interface Utterance {
  id: string;
  text: string;
  speakerId: string;
  speakerName: string;
  timestamp: Date;
  offsetMs: number;
  durationMs?: number;
  confidence?: number;
  isFinal: boolean;
}
```

---

## ストレージスキーマ

### sessionStorage キー

| キー | 値の型 | 説明 |
|------|--------|------|
| `voiceProfiles` | `StoredVoiceProfile[]` | 保存された音声プロフィール |
| `currentSession` | `DiarizationSession` | 現在のセッション状態 |

### 容量見積もり

| データ | サイズ（概算） |
|--------|---------------|
| VoiceProfile (30秒音声) | ~1MB |
| 最大プロフィール数 | 5-10件 |
| セッション状態 | ~50KB |
| 発話履歴（100件） | ~20KB |

---

## リレーションシップ

```
VoiceProfile (1) ────────── (0..1) SpeakerMapping
     │
     │ selectedProfileIds[]
     │
DiarizationSession (1) ────── (0..*) SpeakerMapping
     │
     │ utterances[]
     │
     └───────────────────────── (0..*) Utterance
                                         │
                                         │ speakerId → SpeakerMapping.speakerId
```
