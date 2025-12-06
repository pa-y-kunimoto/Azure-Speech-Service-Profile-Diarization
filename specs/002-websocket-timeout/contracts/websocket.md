# WebSocket Protocol: タイムアウト機能拡張

**Feature**: 002-websocket-timeout  
**Date**: 2025-12-05

## 概要

既存の WebSocket プロトコルにタイムアウト関連のメッセージタイプを追加する。
既存のメッセージタイプとの後方互換性を維持。

---

## 新規メッセージタイプ

### Server → Client

#### `timeout_status` - タイムアウト状態更新

セッション中、1秒ごとにサーバーから送信される。

```json
{
  "type": "timeout_status",
  "sessionTimeoutRemaining": 840,
  "silenceTimeoutRemaining": 120
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"timeout_status"` | メッセージタイプ（固定） |
| `sessionTimeoutRemaining` | `number \| null` | セッションタイムアウトまでの残り秒数。`null` = 無制限 |
| `silenceTimeoutRemaining` | `number \| null` | 無音タイムアウトまでの残り秒数。`null` = 無効 |

---

#### `timeout_warning` - タイムアウト警告

タイムアウト1分前に送信される。

```json
{
  "type": "timeout_warning",
  "warningType": "session",
  "remainingSeconds": 60,
  "message": "セッションがあと1分で終了します。延長しますか？"
}
```

```json
{
  "type": "timeout_warning",
  "warningType": "silence",
  "remainingSeconds": 60,
  "message": "1分間発話が検出されていません。発話するとセッションが継続します。"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"timeout_warning"` | メッセージタイプ（固定） |
| `warningType` | `"session" \| "silence"` | 警告の種類 |
| `remainingSeconds` | `number` | タイムアウトまでの残り秒数 |
| `message` | `string` | ユーザー向けメッセージ（日本語） |

---

#### `timeout_ended` - タイムアウトによるセッション終了

タイムアウトでセッションが終了した際に送信される。

```json
{
  "type": "timeout_ended",
  "reason": "session_timeout",
  "message": "セッション時間が終了しました。"
}
```

```json
{
  "type": "timeout_ended",
  "reason": "silence_timeout",
  "message": "無音のためセッションを終了しました。"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"timeout_ended"` | メッセージタイプ（固定） |
| `reason` | `"session_timeout" \| "silence_timeout"` | 終了理由 |
| `message` | `string` | ユーザー向けメッセージ（日本語） |

---

### Client → Server

#### `control` with `action: "extend"` - セッション延長

セッションタイムアウトを延長する。

```json
{
  "type": "control",
  "action": "extend"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"control"` | メッセージタイプ（既存） |
| `action` | `"extend"` | アクション（新規追加） |

**Server Response**: 成功時は `status` メッセージ、失敗時は `error` メッセージ

成功時:
```json
{
  "type": "status",
  "status": "extended",
  "message": "セッションを延長しました。"
}
```

失敗時（タイムアウト無効の場合など）:
```json
{
  "type": "error",
  "code": "EXTEND_NOT_AVAILABLE",
  "message": "セッション延長は利用できません（タイムアウトが無効です）。",
  "recoverable": true
}
```

---

## 既存メッセージタイプへの変更

### `status` メッセージの拡張

`status` フィールドに新しい値を追加:

| status value | Description |
|--------------|-------------|
| `extended` | セッション延長成功 |

---

## メッセージフロー

### 正常フロー（セッションタイムアウト）

```
Client                          Server
   |                               |
   |---- connect -----------------→|
   |←--- status: connected --------|
   |                               |
   |---- control: start ----------→|
   |←--- status: active -----------|
   |                               |
   |←--- timeout_status (1秒毎) ---|  ← 残り時間更新
   |←--- timeout_status -----------|
   |     ...                       |
   |                               |
   |←--- timeout_warning ----------|  ← 1分前警告
   |                               |
   |---- control: extend ---------→|  ← ユーザーが延長
   |←--- status: extended ---------|
   |                               |
   |←--- timeout_status -----------|  ← タイマーリセット済み
   |     ...                       |
```

### 無音タイムアウトフロー

```
Client                          Server
   |                               |
   |←--- timeout_status -----------|
   |     sessionRemaining: 840     |
   |     silenceRemaining: 300     |
   |                               |
   |     (5分間発話なし)           |
   |                               |
   |←--- timeout_warning ----------|  ← 無音警告
   |     warningType: silence      |
   |     remainingSeconds: 60      |
   |                               |
   |     (1分後)                   |
   |                               |
   |←--- timeout_ended ------------|  ← 無音でセッション終了
   |     reason: silence_timeout   |
   |                               |
   |     (WebSocket close)         |
```

### 発話による無音タイマーリセット

```
Client                          Server
   |                               |
   |←--- timeout_status -----------|
   |     silenceRemaining: 60      |  ← 残り1分
   |                               |
   |---- audio (発話あり) --------→|
   |←--- transcription ------------|
   |                               |
   |←--- timeout_status -----------|
   |     silenceRemaining: 300     |  ← リセットされて5分に戻る
```

---

## エラーコード（新規）

| Code | Description | Recoverable |
|------|-------------|-------------|
| `EXTEND_NOT_AVAILABLE` | 延長機能が利用できない（タイムアウト無効時） | true |
| `SESSION_TIMEOUT` | セッションタイムアウトによる終了 | false |
| `SILENCE_TIMEOUT` | 無音タイムアウトによる終了 | false |
