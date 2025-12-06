# Research: WebSocket セッションタイムアウト設定

**Feature**: 002-websocket-timeout  
**Date**: 2025-12-05

## 1. Node.js タイマー管理のベストプラクティス

### Decision: `setTimeout` / `setInterval` + クリーンアップ管理

### Rationale
- Node.js 標準の `setTimeout` は精度が十分（±数ms、要件の ±10秒を大幅に上回る）
- `setInterval` で残り時間を定期的にブロードキャストし、クライアントと同期
- セッション終了時に `clearTimeout` / `clearInterval` で確実にクリーンアップ

### Alternatives Considered
1. **node-cron**: スケジュール実行向けであり、動的なセッションタイマーには過剰
2. **RxJS Timer**: リアクティブプログラミングの学習コストが高く、既存コードベースと整合しない
3. **Redis TTL**: 外部依存が増え、シンプルなタイマーには過剰

### Implementation Notes
```typescript
// タイマー管理の基本パターン
class SessionTimer {
  private sessionTimeout: NodeJS.Timeout | null = null;
  private warningTimeout: NodeJS.Timeout | null = null;
  private tickInterval: NodeJS.Timeout | null = null;

  start(durationMs: number, onWarning: () => void, onTimeout: () => void): void {
    this.clear();
    
    const warningMs = durationMs - 60_000; // 1分前
    if (warningMs > 0) {
      this.warningTimeout = setTimeout(onWarning, warningMs);
    }
    
    this.sessionTimeout = setTimeout(onTimeout, durationMs);
  }

  clear(): void {
    if (this.sessionTimeout) clearTimeout(this.sessionTimeout);
    if (this.warningTimeout) clearTimeout(this.warningTimeout);
    if (this.tickInterval) clearInterval(this.tickInterval);
  }
}
```

---

## 2. 環境変数設定のベストプラクティス

### Decision: 型安全な環境変数読み取り + バリデーション

### Rationale
- 既存の `env.d.ts` パターンに従い、TypeScript で型安全に
- 起動時にバリデーションし、不正値はデフォルトにフォールバック
- 0 は「無効（無制限）」として特別扱い

### Environment Variables
```typescript
// apps/api/src/env.d.ts に追加
interface ProcessEnv {
  /** セッションタイムアウト（分）。0 = 無制限。デフォルト: 15 */
  SESSION_TIMEOUT_MINUTES?: string;
  
  /** 無音タイムアウト（分）。0 = 無効。デフォルト: 5 */
  SILENCE_TIMEOUT_MINUTES?: string;
}
```

### Validation Pattern
```typescript
function parseTimeoutMinutes(
  value: string | undefined,
  defaultValue: number,
  min: number,
  max: number
): number | null {
  if (value === undefined || value === '') return defaultValue;
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  if (parsed === 0) return null; // 無制限
  if (parsed < min) return min;
  if (parsed > max) return max;
  
  return parsed;
}
```

---

## 3. WebSocket メッセージプロトコル拡張

### Decision: 既存プロトコルに新しいメッセージタイプを追加

### Rationale
- 既存の `type` ベースのメッセージ構造を維持
- 後方互換性を保ちつつ、タイムアウト関連メッセージを追加

### New Message Types

#### Server → Client

```typescript
// タイムアウト状態更新（定期送信）
interface TimeoutStatusMessage {
  type: 'timeout_status';
  sessionTimeoutRemaining: number | null; // 残り秒数、null = 無制限
  silenceTimeoutRemaining: number | null; // 残り秒数、null = 無効
}

// タイムアウト警告
interface TimeoutWarningMessage {
  type: 'timeout_warning';
  warningType: 'session' | 'silence';
  remainingSeconds: number;
  message: string;
}

// タイムアウトによるセッション終了
interface TimeoutEndedMessage {
  type: 'timeout_ended';
  reason: 'session_timeout' | 'silence_timeout';
  message: string;
}
```

#### Client → Server

```typescript
// セッション延長リクエスト
interface ExtendSessionMessage {
  type: 'control';
  action: 'extend';
}
```

---

## 4. 無音検出の実装アプローチ

### Decision: `transcribed` イベントをトリガーとして無音タイマーをリセット

### Rationale
- 既存の `RealtimeService` が `transcribed` イベントを発火済み
- 音声認識結果（テキスト）が得られた = 発話があった、と判定
- ノイズのみの場合はテキストが空または `transcribed` が発火しないため、発話とみなさない

### Implementation Notes
```typescript
// RealtimeService の既存イベントを活用
service.on('transcribed', (utterance) => {
  // 発話検出 → 無音タイマーリセット
  silenceTimer.reset();
});
```

---

## 5. クライアント側の残り時間表示

### Decision: サーバーから定期送信される `timeout_status` を使用

### Rationale
- サーバー側タイマーが正（single source of truth）
- クライアントはサーバーからの値を表示するだけ（クライアント側タイマー不要）
- 1秒ごとの更新はサーバー負荷とネットワーク帯域のバランスを考慮

### Implementation Notes
```typescript
// サーバー側: 1秒ごとにステータス送信
setInterval(() => {
  broadcastTimeoutStatus(sessionId, {
    sessionTimeoutRemaining: calculateRemaining(sessionTimer),
    silenceTimeoutRemaining: calculateRemaining(silenceTimer),
  });
}, 1000);
```

---

## 6. セッション一時停止（pause）時のタイマー動作

### Decision: 一時停止中もタイマーは継続

### Rationale
- 仕様書の Clarifications で「一時停止中もタイマーは継続する（コスト発生の可能性があるため）」と決定済み
- Azure Speech Service への接続は維持されている可能性があり、課金対象となる
- シンプルな実装を維持

---

## 7. 複数タブ対応

### Decision: サーバー側の単一タイマーで管理、全クライアントにブロードキャスト

### Rationale
- 既存の `clients` Map（`ws/index.ts`）を使用し、同一セッションの全クライアントにメッセージ送信
- タイマーはセッションごとに1つ（タブごとではない）
- 延長操作はどのタブからでも可能、全タブに反映

---

## 8. 既存コードへの影響分析

### 変更が必要なファイル

| ファイル | 変更内容 |
|----------|----------|
| `apps/api/src/env.d.ts` | 環境変数型定義追加 |
| `apps/api/src/ws/index.ts` | タイムアウトサービス統合、延長アクション処理 |
| `apps/api/src/ws/handler.ts` | `extend` アクションの処理追加 |
| `apps/web/composables/useRealtimeRecognition.ts` | タイムアウト状態・警告ハンドリング追加 |

### 新規作成ファイル

| ファイル | 内容 |
|----------|------|
| `apps/api/src/services/sessionTimeoutService.ts` | タイムアウト管理サービス |
| `apps/web/components/SessionTimer.vue` | 残り時間表示コンポーネント |
| `apps/web/components/TimeoutWarningModal.vue` | 警告モーダルコンポーネント |

---

## 9. テスト戦略

### Unit Tests
- `SessionTimeoutService`: タイマー開始/停止/延長/無音リセット
- 環境変数パース関数: 境界値、無効値、デフォルト値

### Integration Tests
- WebSocket 経由でのタイムアウト警告受信
- 延長操作によるタイマーリセット
- 無音タイムアウトと通常タイムアウトの独立動作

### Contract Tests
- 新しいメッセージタイプのスキーマ検証
