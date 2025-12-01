/// <reference types="node" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** Server port number */
      PORT?: string;

      /** Node environment: 'development' | 'production' | 'test' */
      NODE_ENV?: "development" | "production" | "test";

      /** Web application base URL */
      WEB_BASE_URL?: string;

      /** API server base URL */
      API_BASE_URL?: string;

      /** CI environment variable */
      CI?: string;

    }
  }
}

export {};
