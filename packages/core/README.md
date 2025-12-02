# @speaker-diarization/core

話者分離アプリケーションの共通型定義とユーティリティ。

## 概要

このパッケージは、アプリケーション全体で共有される型定義とバリデーションユーティリティを提供します。

## インストール

```bash
npm install @speaker-diarization/core
```

## 型定義

### VoiceProfile

音声プロフィールを表す型。

```typescript
import type { VoiceProfile, AudioFormat, AudioSource } from '@speaker-diarization/core';

const profile: VoiceProfile = {
  id: 'uuid-v4',
  name: '田中さん',
  audioData: blob,
  durationMs: 5000,
  format: {
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16,
    codec: 'PCM'
  },
  source: 'upload',
  createdAt: new Date()
};
```

### DiarizationSession

話者分離セッションを表す型。

```typescript
import type { DiarizationSession, SessionStatus } from '@speaker-diarization/core';

const session: DiarizationSession = {
  id: 'uuid-v4',
  status: 'active',
  startedAt: new Date(),
  selectedProfileIds: ['profile-1', 'profile-2'],
  speakerMappings: [],
  utterances: [],
  error: null
};
```

### SpeakerMapping

話者IDとプロフィールのマッピング。

```typescript
import type { SpeakerMapping } from '@speaker-diarization/core';

const mapping: SpeakerMapping = {
  speakerId: 'Guest-1',
  profileId: 'profile-uuid',
  profileName: '田中さん',
  isRegistered: true,
  registeredAt: new Date()
};
```

### Utterance

認識された発話。

```typescript
import type { Utterance } from '@speaker-diarization/core';

const utterance: Utterance = {
  id: 'uuid-v4',
  sessionId: 'session-uuid',
  azureSpeakerId: 'Guest-1',
  speakerName: '田中さん',
  text: 'こんにちは',
  startOffsetSeconds: 0,
  endOffsetSeconds: 2,
  durationSeconds: 2,
  confidence: 0.95,
  recognizedAt: new Date().toISOString()
};
```

## バリデーション

```typescript
import { validateProfileName, validateAudioDuration, ValidationResult } from '@speaker-diarization/core';

// プロフィール名のバリデーション（1-50文字）
const nameResult: ValidationResult = validateProfileName('田中さん');
// { valid: true }

// 音声長のバリデーション（最低5秒）
const durationResult: ValidationResult = validateAudioDuration(3000);
// { valid: false, error: '音声は最低5秒以上必要です' }
```

## ディレクトリ構成

```
packages/core/
├── src/
│   ├── index.ts
│   ├── types/
│   │   ├── voiceProfile.ts
│   │   ├── diarizationSession.ts
│   │   ├── speakerMapping.ts
│   │   └── utterance.ts
│   └── utils/
│       └── validation.ts
└── tests/
    └── unit/
```

## ライセンス

MIT
