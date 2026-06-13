import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "NEXT_PUBLIC_");

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "inject-process-polyfill",
        renderChunk(code) {
          return {
            code: `(function(){if(typeof process==="undefined"){globalThis.process={env:{}}}})();\n${code}`,
            map: null,
          };
        },
      },
    ],
    define: {
      "process.env.NEXT_PUBLIC_FIREBASE_API_KEY": JSON.stringify(env.NEXT_PUBLIC_FIREBASE_API_KEY),
      "process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN": JSON.stringify(env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
      "process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID": JSON.stringify(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
      "process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET": JSON.stringify(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
      "process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID": JSON.stringify(env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
      "process.env.NEXT_PUBLIC_FIREBASE_APP_ID": JSON.stringify(env.NEXT_PUBLIC_FIREBASE_APP_ID),
    },
    build: {
      lib: {
        entry: "src/main.tsx",
        name: "ApexChat",
        formats: ["iife"],
        fileName: () => "widget.js",
      },
      rollupOptions: {
        external: [],
      },
      cssCodeSplit: false,
      minify: "esbuild",
    },
  };
});
