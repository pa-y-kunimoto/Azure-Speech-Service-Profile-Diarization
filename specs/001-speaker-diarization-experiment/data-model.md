# Data Model: 話者分離・話者認識実験アプリケーション

**Date**: 2025-12-01  
**Updated**: 2025-12-03  
**Feature**: 001-speaker-diarization-experiment  
**Status**: Complete (Implementation Reflects Actual Behavior)

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
| azureSpeakerId | string \| undefined | - | エンロールメント時に紐付けられた Azure speakerId（未割当時は undefined） |

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
[作成中] → [保存済み] → [セッション登録済み] → [スピーカー割当済み]
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
| isEnrolling | boolean | - | エンロールメント処理中フラグ |

### SessionStatus（列挙型）

| 値 | 説明 |
|------|------|
| idle | 初期状態 |
| connecting | Azure に接続中 |
| registering | プロフィール登録中（エンロールメント） |
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

**重要**: Azure ConversationTranscriber は事前登録したプロフィールとの照合を行わない。
speakerId は動的に割り当てられ、エンロールメント時または手動でマッピングを設定する必要がある。

### 属性

| 属性名 | 型 | 必須 | 説明 |
|--------|------|------|------|
| speakerId | string | ✅ | Azure が割り当てた ID（例: "Guest-1"） |
| profileId | string | - | 対応する VoiceProfile の ID（未割当時は undefined） |
| profileName | string | ✅ | 表示名（プロフィール名または "Unknown Speaker"） |
| isRegistered | boolean | ✅ | プロフィールに紐づいているか |
| registeredAt | Date | - | 登録日時 |
| mappingSource | "enrollment" \| "manual" | - | マッピングの設定方法 |

### バリデーションルール

- `speakerId`: Azure から返される形式（"Guest-N" または類似形式）
- `profileName`: 未登録話者は "Unknown Speaker (speakerId)" 形式

### マッピングフロー

```
1. エンロールメント時の自動マッピング:
   Profile Audio → Azure → speakerId detected → Auto-map

2. 手動マッピング:
   User clicks speakerId → Selects profile → Manual-map
```

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
| isEnrollment | boolean | - | エンロールメント音声からの発話かどうか |
| enrollmentProfileName | string | - | エンロールメント発話の場合、対応するプロフィール名 |

### バリデーションルール

- `text`: 空文字でない
- `confidence`: 0.0〜1.0 の範囲
- `offsetMs`: 0 以上

### 発話の種類

| 種類 | isEnrollment | 説明 |
|------|--------------|------|
| リアルタイム発話 | false | マイクからのリアルタイム音声認識結果 |
| エンロールメント発話 | true | プロフィール音声の認識結果（話者マッピング学習用） |

---

## 5. ProfileRegistration（プロフィール登録情報）

エンロールメント時にバックエンドに送信されるプロフィール情報。

### 属性

| 属性名 | 型 | 必須 | 説明 |
|--------|------|------|------|
| profileId | string | ✅ | プロフィール ID |
| profileName | string | ✅ | プロフィール名 |
| audioBase64 | string | ✅ | Base64 エンコードされた音声データ |

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
  azureSpeakerId?: string;  // Assigned during enrollment
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
  isEnrolling?: boolean;
}
```

```typescript
// packages/core/src/types/speakerMapping.ts
export type MappingSource = "enrollment" | "manual";

export interface SpeakerMapping {
  speakerId: string;
  profileId?: string;
  profileName: string;
  isRegistered: boolean;
  registeredAt?: Date;
  mappingSource?: MappingSource;
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
  isEnrollment?: boolean;
  enrollmentProfileName?: string;
}
```

```typescript
// apps/api/src/services/realtimeService.ts
export interface ProfileRegistration {
  profileId: string;
  profileName: string;
  audioBase64: string;
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
     │                             │
     │ selectedProfileIds[]        │ speakerId
     │                             │
DiarizationSession (1) ────── (0..*) SpeakerMapping
     │                             │
     │ utterances[]                │ speakerId → SpeakerMapping.speakerId
     │                             │
     └───────────────────────── (0..*) Utterance
```

### 実装上の注意点

1. **speakerId の動的割り当て**:
   - Azure は `Guest-1`, `Guest-2` 形式で動的に割り当て
   - セッション開始時にはプロフィールの azureSpeakerId は undefined
   - エンロールメント後に speakerId が割り当てられる

2. **マッピングの優先順位**:
   - エンロールメント時の自動マッピング → 手動マッピングで上書き可能

3. **エンロールメント発話の識別**:
   - `isEnrollment: true` の発話は UI で区別表示（紫色背景）
   - `enrollmentProfileName` でどのプロフィールの音声かを特定

---

## UI 表示ルール

### 話者名の表示

| 条件 | 表示内容 |
|------|----------|
| マッピング済み | プロフィール名（例: "田中さん"） |
| 未マッピング | speakerId（例: "Guest-1"） |
| Unknown | "Unknown Speaker" |

### 発話の表示スタイル

| 種類 | スタイル |
|------|----------|
| リアルタイム発話 | 通常表示（白背景） |
| エンロールメント発話 | 紫背景 + 🎤バッジ |
| 中間結果 | グレー表示 + イタリック |
