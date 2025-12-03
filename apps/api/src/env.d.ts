/// <reference types="node" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** Azure Speech Service subscription key */
      SPEECH_KEY?: string;

      /** Azure Speech Service endpoint URL */
      SPEECH_ENDPOINT?: string;

      /** Azure Speech Service region (e.g., 'japaneast') */
      SPEECH_REGION?: string;

      /** Server port number */
      API_PORT?: string;

      /** Node environment: 'development' | 'production' | 'test' */
      NODE_ENV?: "development" | "production" | "test";

      /** Enable mock mode for Azure Speech Service */
      MOCK_AZURE?: "true" | "false";

      /** Use mock DiarizationClient */
      USE_MOCK_SPEECH?: "true" | "false";
    }
  }
}

export {};
