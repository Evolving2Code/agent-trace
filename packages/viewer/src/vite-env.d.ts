/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RUN_FILE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css" {
  const content: string;
  export default content;
}
