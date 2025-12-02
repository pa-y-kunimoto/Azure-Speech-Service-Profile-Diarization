# @speaker-diarization/speech-client

Azure Speech Service SDK のラッパーライブラリ。

## 概要

このパッケージは、Azure Speech Service の会話文字起こし（Conversation Transcription）機能を使いやすくラップしたクライアントを提供します。

## インストール

```bash
npm install @speaker-diarization/speech-client
```

## 使用方法

### DiarizationClient

話者分離セッションを管理するクライアント。

```typescript
import { DiarizationClient } from '@speaker-diarization/speech-client';

const client = new DiarizationClient({
  speechKey: process.env.SPEECH_KEY,
  speechEndpoint: process.env.SPEECH_ENDPOINT
});

// セッション開始
await client.startSession();

// 話者登録
await client.registerSpeaker(profileId, audioBuffer);

// コールバック設定
client.onTranscribed((result) => {
  console.log(`${result.speakerId}: ${result.text}`);
});

// セッション終了
await client.stopSession();
```

### AudioProcessor

音声データのストリーム処理。

```typescript
import { AudioProcessor } from '@speaker-diarization/speech-client';

const processor = new AudioProcessor({
  sampleRate: 16000,
  channels: 1,
  bitsPerSample: 16
});

// 音声チャンクを送信
processor.pushAudioChunk(chunk);

// ストリームを閉じる
processor.close();
```

## API

### DiarizationClient

| メソッド | 説明 |
|----------|------|
| `startSession()` | 話者分離セッションを開始 |
| `stopSession()` | セッションを終了 |
| `registerSpeaker(id, audio)` | 話者プロフィールを登録 |
| `pushAudio(chunk)` | 音声データを送信 |
| `onTranscribed(callback)` | 認識結果のコールバック |
| `onSpeakerRegistered(callback)` | 話者登録完了のコールバック |
| `onError(callback)` | エラーのコールバック |

### AudioProcessor

| メソッド | 説明 |
|----------|------|
| `pushAudioChunk(chunk)` | 音声チャンクを追加 |
| `getStream()` | PushStream を取得 |
| `close()` | ストリームを閉じる |

## 対応する Azure 機能

- **Conversation Transcription**: 複数話者の会話を文字起こし
- **Speaker Diarization**: 話者を識別してラベル付け
- **Real-time Streaming**: リアルタイム音声ストリーム処理

## 音声フォーマット要件

| パラメータ | 推奨値 |
|-----------|--------|
| サンプルレート | 16kHz |
| チャンネル | モノラル |
| ビット深度 | 16-bit |
| フォーマット | WAV / PCM |

## ディレクトリ構成

```
packages/speech-client/
├── src/
│   ├── index.ts
│   ├── diarizationClient.ts
│   └── audioProcessor.ts
└── tests/
    └── unit/
```

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `SPEECH_KEY` | Azure Speech Service APIキー |
| `SPEECH_ENDPOINT` | Azure Speech Service エンドポイント |

## 依存関係

- `microsoft-cognitiveservices-speech-sdk`
- `@speaker-diarization/core`

## ライセンス

MIT
