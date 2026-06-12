import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      'process.env.TSS_PRERENDERING': '"false"',
      'process.env.TSS_SHELL': '"false"',
      'process.env.NODE_ENV': '"production"',
    }
  }
});