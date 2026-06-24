import { defineConfig } from "@lovable.dev/vite-tanstack-config";

if (process.env.VERCEL) {
  process.env.SERVER_PRESET = "vercel";
}

// TanStack Start entry — points to our SSR error wrapper.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      port: 8433,
      strictPort: false,
    },
  },
});
