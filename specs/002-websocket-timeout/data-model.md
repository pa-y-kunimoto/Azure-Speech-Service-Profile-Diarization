# Data Model: WebSocket セッションタイムアウト設定

**Feature**: 002-websocket-timeout  
**Date**: 2025-12-05

## Entities

### SessionTimeoutConfig

セッションタイムアウトの設定値を表す（環境変数から読み込み）。

| Field | Type | Description |
|-------|------|-------------|
| `sessionTimeoutMinutes` | `number \| null` | セッションタイムアウト（分）。`null` = 無制限 |
| `silenceTimeoutMinutes` | `number \| null` | 無音タイムアウト（分）。`null` = 無効 |
| `warningBeforeSeconds` | `number` | 警告を表示する秒数（固定: 60秒） |

**Validation Rules**:
- `sessionTimeoutMinutes`: 1-120 の範囲、または `null`（0 入力時）
- `silenceTimeoutMinutes`: 1-120 の範囲、または `null`（0 入力時）
- デフォルト: `sessionTimeoutMinutes = 15`, `silenceTimeoutMinutes = 5`

---

### SessionTimeoutState

セッションごとのタイムアウト状態を表す（ランタイム管理）。

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | `string` | セッション識別子 |
| `sessionStartedAt` | `number` | セッション開始時刻（Unix ms） |
| `sessionTimeoutAt` | `number \| null` | セッションタイムアウト時刻（Unix ms）。`null` = 無制限 |
| `lastSpeechAt` | `number` | 最終発話検出時刻（Unix ms） |
| `silenceTimeoutAt` | `number \| null` | 無音タイムアウト時刻（Unix ms）。`null` = 無効 |
| `sessionWarningShown` | `boolean` | セッションタイムアウト警告表示済みフラグ |
| `silenceWarningShown` | `boolean` | 無音タイムアウト警告表示済みフラグ |
| `isPaused` | `boolean` | 一時停止状態 |

**State Transitions**:
```
[初期化] → sessionStartedAt = now, lastSpeechAt = now
    ↓
[発話検出] → lastSpeechAt = now, silenceWarningShown = false, silenceTimeoutAt 再計算
    ↓
[セッション延長] → sessionTimeoutAt 再計算, sessionWarningShown = false
    ↓
[警告時刻到達] → sessionWarningShown = true または silenceWarningShown = true
    ↓
[タイムアウト] → セッション終了
```

---

### TimeoutWarning

タイムアウト警告の状態を表す。

| Field | Type | Description |
|-------|------|-------------|
| `warningType` | `'session' \| 'silence'` | 警告の種類 |
| `remainingSeconds` | `number` | 残り秒数 |
| `message` | `string` | ユーザー向けメッセージ |

---

### TimeoutStatus

クライアントに送信するタイムアウト状態。

| Field | Type | Description |
|-------|------|-------------|
| `sessionTimeoutRemaining` | `number \| null` | セッションタイムアウトまでの残り秒数。`null` = 無制限 |
| `silenceTimeoutRemaining` | `number \| null` | 無音タイムアウトまでの残り秒数。`null` = 無効 |

---

## TypeScript Type Definitions

```typescript
// apps/api/src/services/sessionTimeoutService.ts

export interface SessionTimeoutConfig {
  sessionTimeoutMinutes: number | null;
  silenceTimeoutMinutes: number | null;
  warningBeforeSeconds: number;
}

export interface SessionTimeoutState {
  sessionId: string;
  sessionStartedAt: number;
  sessionTimeoutAt: number | null;
  lastSpeechAt: number;
  silenceTimeoutAt: number | null;
  sessionWarningShown: boolean;
  silenceWarningShown: boolean;
  isPaused: boolean;
}

export interface TimeoutWarning {
  warningType: 'session' | 'silence';
  remainingSeconds: number;
  message: string;
}

export interface TimeoutStatus {
  sessionTimeoutRemaining: number | null;
  silenceTimeoutRemaining: number | null;
}
```

---

## Client-Side State (Vue)

```typescript
// apps/web/composables/useRealtimeRecognition.ts に追加

export interface TimeoutState {
  sessionTimeoutRemaining: number | null;
  silenceTimeoutRemaining: number | null;
  warning: TimeoutWarning | null;
  isSessionTimeoutEnabled: boolean;
  isSilenceTimeoutEnabled: boolean;
}
```

---

## Relationships

```
SessionTimeoutConfig (1) ←──── (N) SessionTimeoutState
         │                              │
         │                              │
         └── 設定値を参照 ──────────────┘
                                        │
                                        ▼
                              TimeoutStatus (クライアント送信)
                                        │
                                        ▼
                              TimeoutWarning (警告時のみ)
```
