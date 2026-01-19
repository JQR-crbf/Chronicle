/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  // 添加更多环境变量...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
