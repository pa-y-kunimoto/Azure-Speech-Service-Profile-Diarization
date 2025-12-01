# Azure-Speech-Service-Profile-Diarization

Azure Speech Service Profile-Based Speaker Diarization - A monorepo for speaker diarization using Azure Speech Services.

## Project Structure

This project uses npm workspaces to manage multiple packages:

```
packages/
├── core/   # Core library with shared utilities and types
├── api/    # API package for Azure Speech Service integration
└── cli/    # Command-line interface
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 7.0.0

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Clean

```bash
npm run clean
```

## Packages

| Package | Description |
|---------|-------------|
| `@azure-speech-diarization/core` | Core library with shared utilities and types |
| `@azure-speech-diarization/api` | API package for Azure Speech Service integration |
| `@azure-speech-diarization/cli` | Command-line interface |

## License

MIT