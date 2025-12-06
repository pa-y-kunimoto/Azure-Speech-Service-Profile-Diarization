# Quickstart: WebSocket セッションタイムアウト設定

**Feature**: 002-websocket-timeout  
**Date**: 2025-12-05

## 概要

この機能は、WebSocket セッションに2種類のタイムアウトを追加し、Azure Speech Service の不要な課金を防止します。

- **セッションタイムアウト**: セッション開始から一定時間（デフォルト15分）で自動終了
- **無音タイムアウト**: 発話がない状態が一定時間（デフォルト5分）続くと自動終了

---

## 環境変数設定

### `.env` ファイル

```bash
# セッションタイムアウト（分）
# 0 = 無制限、1-120 = タイムアウト時間
# デフォルト: 15
SESSION_TIMEOUT_MINUTES=15

# 無音タイムアウト（分）
# 0 = 無効、1-120 = タイムアウト時間
# デフォルト: 5
SILENCE_TIMEOUT_MINUTES=5
```

### 設定例

| ユースケース | SESSION_TIMEOUT_MINUTES | SILENCE_TIMEOUT_MINUTES |
|--------------|-------------------------|-------------------------|
| デフォルト | 15 | 5 |
| 短い会議向け | 10 | 3 |
| 長時間ワークショップ | 60 | 10 |
| タイムアウト無効 | 0 | 0 |

---

## クライアント側の使用方法

### 残り時間の取得

```typescript
const {
  status,
  timeoutState, // 新規追加
  // ...
} = useRealtimeRecognition({ sessionId: 'xxx' });

// 残り時間を表示
watchEffect(() => {
  if (timeoutState.value) {
    console.log('セッション残り:', timeoutState.value.sessionTimeoutRemaining, '秒');
    console.log('無音残り:', timeoutState.value.silenceTimeoutRemaining, '秒');
  }
});
```

### 警告への対応

```typescript
const { onTimeoutWarning } = useRealtimeRecognition({
  sessionId: 'xxx',
  onTimeoutWarning: (warning) => {
    if (warning.warningType === 'session') {
      // セッション延長ダイアログを表示
      showExtendDialog();
    } else {
      // 無音警告を表示（発話すれば自動延長）
      showSilenceWarning(warning.message);
    }
  },
});
```

### セッション延長

```typescript
const { extend } = useRealtimeRecognition({ sessionId: 'xxx' });

// ユーザーが延長ボタンをクリック
async function handleExtend() {
  await extend();
  // 成功すると status が 'extended' になり、タイマーがリセット
}
```

---

## UI コンポーネント

### SessionTimer.vue

残り時間を表示するコンポーネント。

```vue
<template>
  <div class="session-timer">
    <span v-if="sessionRemaining !== null">
      残り時間: {{ formatTime(sessionRemaining) }}
    </span>
    <span v-if="silenceRemaining !== null" class="silence-indicator">
      無音: {{ formatTime(silenceRemaining) }}
    </span>
  </div>
</template>
```

### TimeoutWarningModal.vue

タイムアウト警告を表示するモーダル。

```vue
<template>
  <div v-if="warning" class="timeout-warning-modal">
    <p>{{ warning.message }}</p>
    <div v-if="warning.warningType === 'session'">
      <button @click="extend">延長する</button>
      <button @click="end">終了する</button>
    </div>
    <div v-else>
      <p>発話すると自動的に継続します</p>
    </div>
  </div>
</template>
```

---

## サーバー側の動作

### タイマー管理フロー

```
1. セッション開始
   ├── セッションタイマー開始（15分）
   └── 無音タイマー開始（5分）

2. 発話検出時
   └── 無音タイマーリセット（5分）

3. 警告時刻到達（残り1分）
   └── timeout_warning メッセージ送信

4. タイムアウト時刻到達
   ├── timeout_ended メッセージ送信
   └── WebSocket & Azure 接続クローズ

5. 延長リクエスト受信
   └── セッションタイマーリセット（+15分）
```

---

## テスト方法

### 手動テスト

1. 環境変数を短く設定（例: `SESSION_TIMEOUT_MINUTES=2`, `SILENCE_TIMEOUT_MINUTES=1`）
2. セッションを開始
3. 以下を確認:
   - 残り時間が1秒ごとに更新される
   - 1分前に警告が表示される
   - 延長ボタンでタイマーがリセットされる
   - タイムアウトでセッションが終了する

### 自動テスト

```bash
# ユニットテスト
npm run test:unit -w apps/api

# 統合テスト
npm run test:integration -w apps/api
```

---

## トラブルシューティング

### タイムアウトが発生しない

- 環境変数 `SESSION_TIMEOUT_MINUTES=0` になっていないか確認
- サーバーログで設定値を確認

### 無音タイムアウトが早すぎる

- 環境変数 `SILENCE_TIMEOUT_MINUTES` の値を増やす
- 発話が正しく検出されているかログで確認

### 延長ができない

- タイムアウトが無効（0）の場合、延長機能は利用不可
- エラーメッセージ `EXTEND_NOT_AVAILABLE` を確認
