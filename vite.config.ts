import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

if (process.env.VERCEL) {
  process.env.SERVER_PRESET = "vercel";
}

// Knex dynamically imports ALL database drivers (sqlite3, mysql2, etc.)
// even if only 'pg' is used. On Vercel, the unused drivers don't exist,
// causing ERR_MODULE_NOT_FOUND at runtime. We alias them to an empty
// module so the bundler replaces them with a harmless no-op.
const unusedDrivers = [
  "sqlite3",
  "better-sqlite3",
  "mysql",
  "mysql2",
  "tedious",
  "oracledb",
  "pg-native",
  "pg-query-stream",
];

const noopPath = resolve(__dirname, "src/lib/_noop.js");

const driverAliases: Record<string, string> = {};
for (const driver of unusedDrivers) {
  driverAliases[driver] = noopPath;
}

// Custom Rollup plugin that intercepts ALL resolution attempts for unused drivers
// This handles both static imports AND dynamic require() calls that knex does internally
function mockUnusedDriversPlugin() {
  return {
    name: "mock-unused-knex-drivers",
    resolveId(id: string) {
      // Match exact package names and any subpath imports
      const baseName = id.split("/")[0];
      if (unusedDrivers.includes(baseName) || unusedDrivers.includes(id)) {
        return { id: noopPath, external: false };
      }
      return null;
    },
  };
}

// TanStack Start entry — points to our SSR error wrapper.
export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: driverAliases,
    },
    server: {
      port: 8433,
      strictPort: false,
      open: true,
    },
    plugins: [
      nitro({
        preset: "vercel",
        alias: driverAliases,
        rollupConfig: {
          plugins: [mockUnusedDriversPlugin()],
        },
      }),
    ],
  },
});
